#!/bin/sh
# ============================================================
# DSM-5 PostgreSQL Data Seeder
# ============================================================
# This script loads DSM-5 condition data from JSON files into
# the dsm5_conditions table. It is designed to be:
#   1. Run as a PostgreSQL docker-entrypoint-initdb.d script
#      (auto-runs on first DB initialization)
#   2. Run manually via: docker exec bhs-db-dev sh /docker-entrypoint-initdb.d/seed-dsm5-data.sh
#   3. Called from scripts/seed-dsm5-data.ps1
#
# Prerequisites:
#   - The dsm5_conditions table must already exist (created by EF Core)
#   - JSON files must be at /data/dsm5-data/conditions/ (mounted via docker-compose)
#
# Idempotent: Uses ON CONFLICT DO NOTHING, safe to re-run.
# ============================================================

set -e

DATA_DIR="/data/dsm5-data/conditions"
DB_NAME="${POSTGRES_DB:-bhs_dev}"
DB_USER="${POSTGRES_USER:-bhs_admin}"

echo "=== DSM-5 Data Seeder ==="

# Check if data directory exists
if [ ! -d "$DATA_DIR" ]; then
    echo "  [SKIP] Data directory not found: $DATA_DIR"
    echo "  This is normal on first run before EF Core creates tables."
    echo "  Run seed-dsm5-data.ps1 after the API starts."
    exit 0
fi

# Count JSON files
FILE_COUNT=$(ls -1 "$DATA_DIR"/*.json 2>/dev/null | wc -l)
if [ "$FILE_COUNT" -eq 0 ]; then
    echo "  [SKIP] No JSON files found in $DATA_DIR"
    exit 0
fi

echo "  Found $FILE_COUNT condition files in $DATA_DIR"

# Check if table exists (it may not on first init before EF Core runs)
TABLE_EXISTS=$(psql -U "$DB_USER" -d "$DB_NAME" -t -A -c \
    "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dsm5_conditions');" 2>/dev/null || echo "false")

if [ "$TABLE_EXISTS" != "t" ]; then
    echo "  [SKIP] Table dsm5_conditions does not exist yet."
    echo "  The API will create it on first start via EF Core."
    echo "  Run seed-dsm5-data.ps1 after the API has started."
    exit 0
fi

# Check current count
CURRENT_COUNT=$(psql -U "$DB_USER" -d "$DB_NAME" -t -A -c "SELECT COUNT(*) FROM dsm5_conditions;" 2>/dev/null || echo "0")
echo "  Current conditions in DB: $CURRENT_COUNT"

if [ "$CURRENT_COUNT" -ge "$FILE_COUNT" ]; then
    echo "  [OK] Database already has $CURRENT_COUNT conditions (>= $FILE_COUNT files). Skipping seed."
    exit 0
fi

# Load each JSON file
SUCCESS=0
ERRORS=0

for f in "$DATA_DIR"/*.json; do
    RESULT=$(psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -t -A <<EOSQL
WITH raw AS (
    SELECT pg_read_file('$f')::jsonb AS data
)
INSERT INTO dsm5_conditions (
    "Id", "Name", "Code", "Category", "Description",
    "DiagnosticCriteria", "DiagnosticFeatures", "AssociatedFeatures",
    "Prevalence", "DevelopmentAndCourse", "RiskAndPrognosticFactors",
    "CultureRelatedIssues", "GenderRelatedIssues", "SuicideRisk",
    "FunctionalConsequences", "DifferentialDiagnosis", "Comorbidity",
    "Specifiers", "PageNumbers", "PresentSections", "MissingSections",
    "IsAvailableForAssessment", "LastUpdated", "ExtractionMetadata"
)
SELECT
    data->>'id',
    data->>'name',
    data->>'code',
    data->>'category',
    COALESCE(data->>'description', ''),
    COALESCE(data->'diagnosticCriteria', '[]'::jsonb),
    data->>'diagnosticFeatures',
    data->>'associatedFeatures',
    data->>'prevalence',
    data->>'developmentAndCourse',
    COALESCE(data->'riskAndPrognosticFactors', 'null'::jsonb),
    data->>'cultureRelatedIssues',
    data->>'genderRelatedIssues',
    data->>'suicideRisk',
    data->>'functionalConsequences',
    COALESCE(data->'differentialDiagnosis', '[]'::jsonb),
    data->>'comorbidity',
    COALESCE(data->'specifiers', '[]'::jsonb),
    COALESCE(data->'pageNumbers', '[]'::jsonb),
    COALESCE(data->'presentSections', '[]'::jsonb),
    COALESCE(data->'missingSections', '[]'::jsonb),
    COALESCE((data->>'isAvailableForAssessment')::boolean, true),
    COALESCE((data->>'lastUpdated')::timestamptz, NOW()),
    data->'extractionMetadata'
FROM raw
ON CONFLICT ("Id") DO NOTHING;
EOSQL
    )

    if [ $? -eq 0 ]; then
        SUCCESS=$((SUCCESS + 1))
    else
        ERRORS=$((ERRORS + 1))
        echo "  [ERROR] Failed: $(basename "$f")"
    fi
done

FINAL_COUNT=$(psql -U "$DB_USER" -d "$DB_NAME" -t -A -c "SELECT COUNT(*) FROM dsm5_conditions;" 2>/dev/null || echo "?")

echo ""
echo "=== Seed Complete ==="
echo "  Processed: $((SUCCESS + ERRORS)) files"
echo "  Success:   $SUCCESS"
echo "  Errors:    $ERRORS"
echo "  Total conditions in DB: $FINAL_COUNT"
