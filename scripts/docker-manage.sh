#!/usr/bin/env bash
# docker-manage.sh
# Docker Compose management script for BHS (Behavioral Health System)
#
# Usage: ./scripts/docker-manage.sh <action> [options]
#   Actions: up, down, rebuild, logs, status, restart, shell, seed
#   Options:
#     --env, -e    Environment: local (default), development, production
#     --service, -s  Specific service: api, web, dam, stt, db, azurite

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Defaults
ACTION=""
ENVIRONMENT="local"
SERVICE=""

# Parse arguments
if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <action> [--env local|development|production] [--service api|web|dam|stt]"
    echo "Actions: up, down, rebuild, logs, status, restart, shell, seed"
    exit 1
fi

ACTION="$1"; shift

while [[ $# -gt 0 ]]; do
    case "$1" in
        --env|-e) ENVIRONMENT="$2"; shift 2 ;;
        --service|-s) SERVICE="$2"; shift 2 ;;
        -h|--help)
            echo "Usage: $0 <action> [--env local|development|production] [--service api|web|dam|stt]"
            echo ""
            echo "Actions:"
            echo "  up       Start containers"
            echo "  down     Stop and remove containers"
            echo "  rebuild  Tear down, rebuild, and start containers"
            echo "  logs     Show container logs (follow mode)"
            echo "  status   Show container status and health"
            echo "  restart  Restart containers"
            echo "  shell    Open a shell in a service container"
            echo "  seed     Seed DSM-5 data into the database"
            exit 0 ;;
        *) echo "Unknown option: $1" >&2; exit 1 ;;
    esac
done

# Validate environment
case "$ENVIRONMENT" in
    local|development|production) ;;
    *) echo "ERROR: Invalid environment: $ENVIRONMENT (use local, development, production)" >&2; exit 1 ;;
esac

# Determine compose file
case "$ENVIRONMENT" in
    local)       COMPOSE_FILE="docker-compose.local.yml" ;;
    development) COMPOSE_FILE="docker-compose.development.yml" ;;
    production)  COMPOSE_FILE="docker-compose.prod.yml" ;;
esac

ENV_FILE_FLAG=""
if [[ "$ENVIRONMENT" == "production" ]] && [[ -f "${REPO_ROOT}/.env.prod" ]]; then
    ENV_FILE_FLAG="--env-file .env.prod"
fi

cd "$REPO_ROOT"

# --- Helper functions ---

header() {
    echo ""
    echo "========================================"
    echo " $1"
    echo "========================================"
    echo ""
}

step() {
    echo "[*] $1"
}

success() {
    echo -e "\033[32m[OK]\033[0m $1"
}

error_msg() {
    echo -e "\033[31m[ERROR]\033[0m $1" >&2
}

compose_cmd() {
    echo "docker compose -f $COMPOSE_FILE $ENV_FILE_FLAG"
}

# --- Actions ---

do_up() {
    header "Starting $ENVIRONMENT Environment"

    if [[ "$ENVIRONMENT" == "production" ]] && [[ ! -f ".env.prod" ]]; then
        error_msg ".env.prod file not found!"
        echo "Copy .env.prod.template to .env.prod and fill in the values."
        return 1
    fi

    local cmd
    cmd=$(compose_cmd)
    if [[ -n "$SERVICE" ]]; then
        step "Starting service: $SERVICE"
        eval "$cmd up -d $SERVICE"
    else
        step "Starting all services..."
        eval "$cmd up -d"
    fi

    success "Services started!"
    echo ""
    do_status
}

do_down() {
    header "Stopping $ENVIRONMENT Environment"

    local cmd
    cmd=$(compose_cmd)
    step "Stopping containers..."
    eval "$cmd down --volumes"

    success "Containers stopped and volumes removed!"
}

do_rebuild() {
    header "Rebuilding $ENVIRONMENT Environment"

    if [[ "$ENVIRONMENT" == "production" ]] && [[ ! -f ".env.prod" ]]; then
        error_msg ".env.prod file not found!"
        echo "Copy .env.prod.template to .env.prod and fill in the values."
        return 1
    fi

    local cmd
    cmd=$(compose_cmd)

    step "Stopping existing containers..."
    eval "$cmd down --volumes" 2>/dev/null || true

    step "Pruning Docker build cache..."
    docker builder prune -f 2>/dev/null || true

    step "Building and starting containers..."
    if [[ -n "$SERVICE" ]]; then
        eval "$cmd up -d --build $SERVICE"
    else
        eval "$cmd up -d --build"
    fi

    success "Rebuild complete!"
    echo ""
    do_status
}

do_logs() {
    header "Container Logs - $ENVIRONMENT"

    local cmd
    cmd=$(compose_cmd)
    if [[ -n "$SERVICE" ]]; then
        step "Showing logs for: $SERVICE"
        eval "$cmd logs -f --tail 100 $SERVICE"
    else
        step "Showing logs for all services..."
        eval "$cmd logs -f --tail 50"
    fi
}

do_status() {
    header "Container Status - $ENVIRONMENT"

    step "Running containers:"
    docker ps --filter "name=bhs" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

    echo ""
    step "Health status:"
    for container in $(docker ps --filter "name=bhs" --format "{{.Names}}"); do
        health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$container" 2>/dev/null)
        case "$health" in
            healthy)        echo -e "  $container : \033[32m$health\033[0m" ;;
            unhealthy)      echo -e "  $container : \033[31m$health\033[0m" ;;
            starting)       echo -e "  $container : \033[33m$health\033[0m" ;;
            *)              echo -e "  $container : $health" ;;
        esac
    done
}

do_restart() {
    header "Restarting $ENVIRONMENT Environment"

    local cmd
    cmd=$(compose_cmd)
    if [[ -n "$SERVICE" ]]; then
        step "Restarting service: $SERVICE"
        eval "$cmd restart $SERVICE"
    else
        step "Restarting all services..."
        eval "$cmd restart"
    fi

    success "Services restarted!"
    echo ""
    do_status
}

do_shell() {
    if [[ -z "$SERVICE" ]]; then
        error_msg "Please specify a service with --service"
        return 1
    fi

    header "Opening shell in $SERVICE"

    local container_name="bhs-${SERVICE}-local"
    if [[ "$ENVIRONMENT" == "development" ]]; then
        container_name="bhs-${SERVICE}"
    elif [[ "$ENVIRONMENT" == "production" ]]; then
        container_name="bhs-${SERVICE}-prod"
    fi

    step "Connecting to $container_name..."
    docker exec -it "$container_name" /bin/sh
}

do_seed() {
    header "Seeding Reference Data - $ENVIRONMENT"

    local mode
    case "$ENVIRONMENT" in
        local)       mode="local" ;;
        development) mode="dev" ;;
        production)  mode="prod" ;;
    esac

    if [[ -f "${SCRIPT_DIR}/seed-database.sh" ]]; then
        step "Running database seed..."
        bash "${SCRIPT_DIR}/seed-database.sh" --mode "$mode"
    elif [[ -f "${SCRIPT_DIR}/seed-database.ps1" ]]; then
        step "Running database seed (PowerShell)..."
        pwsh -File "${SCRIPT_DIR}/seed-database.ps1" -Mode "$mode"
    else
        error_msg "No seed script found (seed-database.sh or seed-database.ps1)"
        return 1
    fi
}

# --- Dispatch ---

case "$ACTION" in
    up)      do_up ;;
    down)    do_down ;;
    rebuild) do_rebuild ;;
    logs)    do_logs ;;
    status)  do_status ;;
    restart) do_restart ;;
    shell)   do_shell ;;
    seed)    do_seed ;;
    *)
        error_msg "Unknown action: $ACTION"
        echo "Valid actions: up, down, rebuild, logs, status, restart, shell, seed"
        exit 1 ;;
esac
