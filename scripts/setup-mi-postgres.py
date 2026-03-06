"""
Setup managed identity PostgreSQL role for Container App.

Prerequisites:
  1. Azure CLI logged in: az login
  2. Entra ID authentication enabled on the PG server (parallel mode recommended)
  3. Current user set as Entra admin on the PG server
  4. Container App has system-assigned managed identity enabled
  5. psycopg2 installed: pip install psycopg2-binary

Usage:
  # Get a fresh Entra token and pass it via environment variable
  $env:PG_TOKEN = az account get-access-token --resource-type oss-rdbms --query accessToken -o tsv
  python scripts/setup-mi-postgres.py

  # Or let the script get the token automatically (requires az CLI in PATH)
  python scripts/setup-mi-postgres.py --auto-token
"""
import subprocess
import json
import sys
import os

# Configuration — update these for your environment
PG_HOST = "bhs-dev-postgres.postgres.database.azure.com"
PG_ADMIN_DB = "postgres"       # pgaadauth extension lives here
PG_APP_DB = "bhs_dev"
PG_ENTRA_ADMIN_USER = "Christopher Woodland"  # Display name of the Entra admin
CONTAINER_APP_NAME = "bhs-api-dam"
RESOURCE_GROUP = "bhs-development-local-dam-public"
MI_ROLE_NAME = "bhs-api-dam"   # PG role name for the managed identity

# Full path to az CLI (fallback if not in PATH)
AZ_CLI_PATH = r"C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"


def get_az_cmd():
    """Return the az command, trying PATH first, then the known install location."""
    import shutil
    az = shutil.which("az") or shutil.which("az.cmd")
    if az:
        return az
    if os.path.exists(AZ_CLI_PATH):
        return AZ_CLI_PATH
    print("ERROR: az CLI not found. Install it or update AZ_CLI_PATH.")
    sys.exit(1)


def get_token():
    """Get an Entra access token for Azure OSS RDBMS."""
    # Check environment variable first
    token = os.environ.get("PG_TOKEN", "").strip()
    if token:
        return token

    if "--auto-token" not in sys.argv:
        print("ERROR: PG_TOKEN environment variable not set.")
        print("  Set it: $env:PG_TOKEN = az account get-access-token --resource-type oss-rdbms --query accessToken -o tsv")
        print("  Or run with --auto-token to fetch automatically.")
        sys.exit(1)

    az = get_az_cmd()
    result = subprocess.run(
        [az, "account", "get-access-token", "--resource-type", "oss-rdbms", "--query", "accessToken", "-o", "tsv"],
        capture_output=True, text=True
    )
    return result.stdout.strip()


def get_mi_info():
    """Get Container App managed identity principal ID and client ID."""
    az = get_az_cmd()

    result = subprocess.run(
        [az, "containerapp", "show", "--name", CONTAINER_APP_NAME,
         "--resource-group", RESOURCE_GROUP,
         "--query", "identity.principalId", "-o", "tsv"],
        capture_output=True, text=True
    )
    principal_id = result.stdout.strip()

    result = subprocess.run(
        [az, "ad", "sp", "show", "--id", principal_id, "--query", "appId", "-o", "tsv"],
        capture_output=True, text=True
    )
    client_id = result.stdout.strip()

    return principal_id, client_id


def run_sql(token, dbname, sql_statements):
    """Connect to PostgreSQL with Entra token and execute SQL statements."""
    import psycopg2

    conn = psycopg2.connect(
        host=PG_HOST,
        port=5432,
        dbname=dbname,
        user=PG_ENTRA_ADMIN_USER,
        password=token,
        sslmode="require"
    )
    conn.autocommit = True
    cur = conn.cursor()
    for sql in sql_statements:
        print(f"  Executing: {sql[:80]}...")
        try:
            cur.execute(sql)
            try:
                rows = cur.fetchall()
                for row in rows:
                    print(f"    -> {row}")
            except Exception:
                print("    -> OK")
        except Exception as e:
            print(f"    -> Error: {e}")
    cur.close()
    conn.close()

if __name__ == "__main__":
    print("=== PostgreSQL Managed Identity Setup ===\n")

    print("1. Getting Entra access token...")
    token = get_token()
    if not token:
        print("ERROR: Could not get access token. Run 'az login' first.")
        sys.exit(1)
    print(f"   Token length: {len(token)}")

    print("2. Getting Container App managed identity info...")
    principal_id, client_id = get_mi_info()
    print(f"   Principal ID: {principal_id}")
    print(f"   Client/App ID: {client_id}")

    if not principal_id:
        print("ERROR: Could not get managed identity info. Enable system-assigned MI on the Container App.")
        sys.exit(1)

    # Step 3: Create the MI role in the 'postgres' database (where pgaadauth extension lives)
    print(f"\n3. Creating PostgreSQL role '{MI_ROLE_NAME}' (on '{PG_ADMIN_DB}' database)...")
    create_role_sql = [
        "SELECT * FROM pgaadauth_list_principals(false);",
        f"SELECT * FROM pgaadauth_create_principal('{MI_ROLE_NAME}', false, false);",
        f'GRANT CONNECT ON DATABASE {PG_APP_DB} TO "{MI_ROLE_NAME}";',
    ]
    run_sql(token, PG_ADMIN_DB, create_role_sql)

    # Step 4: Grant permissions on the application database
    print(f"\n4. Granting permissions on '{PG_APP_DB}' database...")
    grant_sql = [
        f'GRANT USAGE, CREATE ON SCHEMA public TO "{MI_ROLE_NAME}";',
        f'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "{MI_ROLE_NAME}";',
        f'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "{MI_ROLE_NAME}";',
        f'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "{MI_ROLE_NAME}";',
        f'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO "{MI_ROLE_NAME}";',
    ]
    run_sql(token, PG_APP_DB, grant_sql)

    # Verify
    print("\n5. Verifying role exists...")
    run_sql(token, PG_ADMIN_DB, ["SELECT * FROM pgaadauth_list_principals(false);"])

    print(f"""
=== Setup Complete ===

PostgreSQL role '{MI_ROLE_NAME}' has been created and granted permissions.

To use managed identity authentication, set these environment variables on the Container App:

  STORAGE_BACKEND=PostgreSQL
  POSTGRES_HOST={PG_HOST}
  POSTGRES_PORT=5432
  POSTGRES_USERNAME={MI_ROLE_NAME}
  POSTGRES_DATABASE={PG_APP_DB}
  POSTGRES_USE_MANAGED_IDENTITY=true

No POSTGRES_PASSWORD is needed — the app uses DefaultAzureCredential to acquire
an Entra ID token as the password automatically.
""")
    print("\n4. Done! The managed identity can now connect to PostgreSQL using token auth.")
    print(f"   Connection username: {mi_role_name}")
    print(f"   Client ID for Azure.Identity: {client_id}")
