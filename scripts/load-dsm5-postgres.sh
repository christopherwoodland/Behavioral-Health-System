#!/bin/sh
# Load DSM-5 condition JSON files into PostgreSQL
# Usage: Run inside the PostgreSQL container with JSON files at /tmp/dsm5-conditions/

DATA_DIR="/tmp/dsm5-conditions"
SUCCESS=0
ERRORS=0

echo "=== DSM-5 PostgreSQL Data Loader ==="
echo "Loading conditions from: $DATA_DIR"

for f in "$DATA_DIR"/*.json; do
    BASENAME=$(basename "$f")

    # Use a SQL function to read and parse the JSON file
    RESULT=$(psql -U "${POSTGRES_USER:-bhs_admin}" -d "${POSTGRES_DB:-bhs_dev}" -v ON_ERROR_STOP=1 -t -A <<EOSQL
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
        echo "  ERROR loading: $BASENAME"
    fi
done

TOTAL=$(psql -U "${POSTGRES_USER:-bhs_admin}" -d "${POSTGRES_DB:-bhs_dev}" -t -A -c "SELECT COUNT(*) FROM dsm5_conditions;")

echo ""
echo "=== Import Complete ==="
echo "  Processed: $((SUCCESS + ERRORS)) files"
echo "  Success:   $SUCCESS"
echo "  Errors:    $ERRORS"
echo "  Total conditions in DB: $TOTAL"
