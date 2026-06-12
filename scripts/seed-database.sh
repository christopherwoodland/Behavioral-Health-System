#!/usr/bin/env bash
# seed-database.sh
# Seeds reference data (DSM-5 conditions) into the PostgreSQL database.
# Bash port of seed-database.ps1. Idempotent - safe to run multiple times.
#
# Usage: ./scripts/seed-database.sh [options]
#   --mode MODE       Deployment mode: airgap, local (default), dev, prod
#   --container NAME  Override container name
#   --db-user USER    PostgreSQL user (default: from env file or bhs_admin)
#   --db-name NAME    PostgreSQL database (default: from env file or bhs_dev)
#   --db-password PW  PostgreSQL password (default: from env file or changeme)
#   --skip-schema     Skip DDL table creation
#   --wait SECONDS    Wait for container readiness (default: 60)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DATA_DIR="${REPO_ROOT}/data/dsm5-data/conditions"

# Defaults
MODE="local"
CONTAINER_NAME=""
DB_USER=""
DB_NAME=""
DB_PASSWORD=""
SKIP_SCHEMA=false
WAIT_SECONDS=60

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --mode) MODE="$2"; shift 2 ;;
        --container) CONTAINER_NAME="$2"; shift 2 ;;
        --db-user) DB_USER="$2"; shift 2 ;;
        --db-name) DB_NAME="$2"; shift 2 ;;
        --db-password) DB_PASSWORD="$2"; shift 2 ;;
        --skip-schema) SKIP_SCHEMA=true; shift ;;
        --wait) WAIT_SECONDS="$2"; shift 2 ;;
        -h|--help)
            echo "Usage: $0 [--mode airgap|local|dev|prod] [--container NAME] [--db-user USER]"
            echo "       [--db-name NAME] [--db-password PW] [--skip-schema] [--wait SECONDS]"
            exit 0 ;;
        *) echo "Unknown option: $1" >&2; exit 1 ;;
    esac
done

# Mode-based defaults
case "$MODE" in
    airgap) DEFAULT_CONTAINER="bhs-db-local"; ENV_FILE="${REPO_ROOT}/docker.env.airgap" ;;
    local)  DEFAULT_CONTAINER="bhs-db-local"; ENV_FILE="${REPO_ROOT}/docker.env" ;;
    dev)    DEFAULT_CONTAINER="bhs-db-dev";   ENV_FILE="${REPO_ROOT}/docker.env" ;;
    prod)   DEFAULT_CONTAINER="bhs-db-prod";  ENV_FILE="${REPO_ROOT}/docker.env" ;;
    *)      echo "ERROR: Invalid mode: $MODE" >&2; exit 1 ;;
esac

[[ -z "$CONTAINER_NAME" ]] && CONTAINER_NAME="$DEFAULT_CONTAINER"

# Load values from env file
if [[ -f "$ENV_FILE" ]]; then
    get_env_val() {
        grep -m1 "^${1}=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- || echo ""
    }
    [[ -z "$DB_USER" ]] && DB_USER=$(get_env_val "POSTGRES_USER")
    [[ -z "$DB_NAME" ]] && DB_NAME=$(get_env_val "POSTGRES_DB")
    [[ -z "$DB_PASSWORD" ]] && DB_PASSWORD=$(get_env_val "POSTGRES_PASSWORD")
else
    echo "[WARN] Env file not found: $ENV_FILE - using defaults"
fi

# Apply final defaults
[[ -z "$DB_USER" ]] && DB_USER="bhs_admin"
[[ -z "$DB_NAME" ]] && DB_NAME="bhs_dev"
[[ -z "$DB_PASSWORD" ]] && DB_PASSWORD="changeme"

# Banner
echo ""
echo "============================================================"
echo "  Behavioral Health System - Database Seeder"
echo "============================================================"
echo ""
echo "  Mode:       $MODE"
echo "  Container:  $CONTAINER_NAME"
echo "  Database:   $DB_NAME"
echo "  User:       $DB_USER"
echo ""

# Verify prerequisites
if [[ ! -d "$DATA_DIR" ]]; then
    echo "[ERROR] DSM-5 data directory not found: $DATA_DIR" >&2
    echo "        Expected: data/dsm5-data/conditions/*.json" >&2
    exit 1
fi

JSON_COUNT=$(find "$DATA_DIR" -name "*.json" -type f | wc -l)
if [[ "$JSON_COUNT" -eq 0 ]]; then
    echo "[ERROR] No JSON files found in: $DATA_DIR" >&2
    exit 1
fi

echo "[INFO] Found $JSON_COUNT DSM-5 condition files"

# Wait for container to be ready
echo "[STEP] Waiting for container '$CONTAINER_NAME' to be ready..."
ELAPSED=0
READY=false
while [[ $ELAPSED -lt $WAIT_SECONDS ]]; do
    STATUS=$(docker inspect --format '{{.State.Running}}' "$CONTAINER_NAME" 2>/dev/null || echo "false")
    if [[ "$STATUS" == "true" ]]; then
        if docker exec "$CONTAINER_NAME" pg_isready -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; then
            READY=true
            break
        fi
    fi
    sleep 2
    ELAPSED=$((ELAPSED + 2))
    echo "  Waiting... ($ELAPSED/${WAIT_SECONDS}s)"
done

if [[ "$READY" != "true" ]]; then
    echo "[ERROR] Container '$CONTAINER_NAME' did not become ready within ${WAIT_SECONDS}s." >&2
    echo "        Is the database running? Try:" >&2
    echo "        docker compose --env-file docker.env.airgap -f docker-compose.local.yml up db -d" >&2
    exit 1
fi

echo "[OK] Database is ready"

# Schema creation
if [[ "$SKIP_SCHEMA" != "true" ]]; then
    echo "[STEP] Ensuring dsm5_conditions table exists..."

    DDL='CREATE TABLE IF NOT EXISTS dsm5_conditions (
    "Id"                       TEXT PRIMARY KEY,
    "Name"                     TEXT NOT NULL,
    "Code"                     TEXT,
    "Category"                 TEXT,
    "Description"              TEXT DEFAULT '"'"''"'"',
    "DiagnosticCriteria"       JSONB DEFAULT '"'"'[]'"'"'::jsonb,
    "DiagnosticFeatures"       TEXT,
    "AssociatedFeatures"       TEXT,
    "Prevalence"               TEXT,
    "DevelopmentAndCourse"     TEXT,
    "RiskAndPrognosticFactors" JSONB,
    "CultureRelatedIssues"    TEXT,
    "GenderRelatedIssues"     TEXT,
    "SuicideRisk"             TEXT,
    "FunctionalConsequences"  TEXT,
    "DifferentialDiagnosis"    JSONB DEFAULT '"'"'[]'"'"'::jsonb,
    "Comorbidity"             TEXT,
    "Specifiers"              JSONB DEFAULT '"'"'[]'"'"'::jsonb,
    "PageNumbers"             JSONB DEFAULT '"'"'[]'"'"'::jsonb,
    "PresentSections"         JSONB DEFAULT '"'"'[]'"'"'::jsonb,
    "MissingSections"         JSONB DEFAULT '"'"'[]'"'"'::jsonb,
    "IsAvailableForAssessment" BOOLEAN DEFAULT TRUE,
    "LastUpdated"             TIMESTAMPTZ DEFAULT NOW(),
    "ExtractionMetadata"      JSONB
);'

    if ! docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -c "$DDL" > /dev/null 2>&1; then
        echo "[ERROR] Failed to create dsm5_conditions table" >&2
        exit 1
    fi
    echo "[OK] Schema verified"
fi

# Check current state
CURRENT_COUNT=$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c "SELECT COUNT(*) FROM dsm5_conditions;" 2>/dev/null | tr -d '[:space:]')
CURRENT_COUNT=${CURRENT_COUNT:-0}

echo "[INFO] Current conditions in database: $CURRENT_COUNT"

if [[ "$CURRENT_COUNT" -ge "$JSON_COUNT" ]]; then
    echo "[OK] Database already has $CURRENT_COUNT conditions (>= $JSON_COUNT files). Nothing to seed."
    exit 0
fi

# Copy data and seed
echo "[STEP] Copying DSM-5 JSON files into container..."
docker exec "$CONTAINER_NAME" sh -c "rm -rf /tmp/dsm5-seed && mkdir -p /tmp/dsm5-seed" > /dev/null 2>&1
docker cp "${DATA_DIR}/." "${CONTAINER_NAME}:/tmp/dsm5-seed/" > /dev/null 2>&1

echo "[STEP] Seeding DSM-5 conditions..."

# Write seed SQL
SEED_SQL='DO $$
DECLARE
    f TEXT;
    raw_json JSONB;
    success_count INT := 0;
    error_count INT := 0;
    file_list TEXT[];
BEGIN
    SELECT array_agg(pg_ls_dir) INTO file_list
    FROM pg_ls_dir('"'"'/tmp/dsm5-seed'"'"')
    WHERE pg_ls_dir LIKE '"'"'%.json'"'"';

    IF file_list IS NULL THEN
        RAISE NOTICE '"'"'No JSON files found in /tmp/dsm5-seed'"'"';
        RETURN;
    END IF;

    FOREACH f IN ARRAY file_list LOOP
        BEGIN
            raw_json := pg_read_file('"'"'/tmp/dsm5-seed/'"'"' || f)::jsonb;

            INSERT INTO dsm5_conditions (
                "Id", "Name", "Code", "Category", "Description",
                "DiagnosticCriteria", "DiagnosticFeatures", "AssociatedFeatures",
                "Prevalence", "DevelopmentAndCourse", "RiskAndPrognosticFactors",
                "CultureRelatedIssues", "GenderRelatedIssues", "SuicideRisk",
                "FunctionalConsequences", "DifferentialDiagnosis", "Comorbidity",
                "Specifiers", "PageNumbers", "PresentSections", "MissingSections",
                "IsAvailableForAssessment", "LastUpdated", "ExtractionMetadata"
            )
            VALUES (
                raw_json->>'"'"'id'"'"',
                raw_json->>'"'"'name'"'"',
                raw_json->>'"'"'code'"'"',
                raw_json->>'"'"'category'"'"',
                COALESCE(raw_json->>'"'"'description'"'"', '"'"''"'"'),
                COALESCE(raw_json->'"'"'diagnosticCriteria'"'"', '"'"'[]'"'"'::jsonb),
                raw_json->>'"'"'diagnosticFeatures'"'"',
                raw_json->>'"'"'associatedFeatures'"'"',
                raw_json->>'"'"'prevalence'"'"',
                raw_json->>'"'"'developmentAndCourse'"'"',
                COALESCE(raw_json->'"'"'riskAndPrognosticFactors'"'"', '"'"'null'"'"'::jsonb),
                raw_json->>'"'"'cultureRelatedIssues'"'"',
                raw_json->>'"'"'genderRelatedIssues'"'"',
                raw_json->>'"'"'suicideRisk'"'"',
                raw_json->>'"'"'functionalConsequences'"'"',
                COALESCE(raw_json->'"'"'differentialDiagnosis'"'"', '"'"'[]'"'"'::jsonb),
                raw_json->>'"'"'comorbidity'"'"',
                COALESCE(raw_json->'"'"'specifiers'"'"', '"'"'[]'"'"'::jsonb),
                COALESCE(raw_json->'"'"'pageNumbers'"'"', '"'"'[]'"'"'::jsonb),
                COALESCE(raw_json->'"'"'presentSections'"'"', '"'"'[]'"'"'::jsonb),
                COALESCE(raw_json->'"'"'missingSections'"'"', '"'"'[]'"'"'::jsonb),
                COALESCE((raw_json->>'"'"'isAvailableForAssessment'"'"')::boolean, true),
                COALESCE((raw_json->>'"'"'lastUpdated'"'"')::timestamptz, NOW()),
                raw_json->'"'"'extractionMetadata'"'"'
            )
            ON CONFLICT ("Id") DO NOTHING;

            success_count := success_count + 1;
        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
            RAISE NOTICE '"'"'Error loading %: %'"'"', f, SQLERRM;
        END;
    END LOOP;

    RAISE NOTICE '"'"'Seed complete: % success, % errors'"'"', success_count, error_count;
END $$;'

# Write SQL to temp file, copy into container, execute
TEMP_SQL="/tmp/bhs-seed-dsm5-$$.sql"
echo "$SEED_SQL" > "$TEMP_SQL"
docker cp "$TEMP_SQL" "${CONTAINER_NAME}:/tmp/dsm5-seed.sql" > /dev/null 2>&1
rm -f "$TEMP_SQL"

docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -f /tmp/dsm5-seed.sql 2>&1 | while IFS= read -r line; do
    if [[ "$line" == *"NOTICE:"* ]]; then
        echo "  $line"
    fi
done

# Verify final state
FINAL_COUNT=$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c "SELECT COUNT(*) FROM dsm5_conditions;" 2>/dev/null | tr -d '[:space:]')
FINAL_COUNT=${FINAL_COUNT:-0}
INSERTED=$((FINAL_COUNT - CURRENT_COUNT))

echo ""
echo "============================================================"
echo "  Seed Results"
echo "============================================================"
echo "  JSON files:       $JSON_COUNT"
echo "  Previously in DB: $CURRENT_COUNT"
echo "  Newly inserted:   $INSERTED"
echo "  Total in DB:      $FINAL_COUNT"
echo ""

# Cleanup
docker exec "$CONTAINER_NAME" sh -c "rm -rf /tmp/dsm5-seed /tmp/dsm5-seed.sql" > /dev/null 2>&1 || true

if [[ "$FINAL_COUNT" -ge "$JSON_COUNT" ]]; then
    echo -e "\033[32m[DONE]\033[0m Database seeded successfully!"
else
    echo "[WARN] Some conditions may not have loaded. Check NOTICE messages above."
fi

echo ""
