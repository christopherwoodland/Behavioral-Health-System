-- Fix bhs-api-dam role OID to match the AKS UAMI (bhs-dev-aks-api-identity)
-- UAMI principalId: debf1bc2-f14a-4eab-80e6-d38824a3bceb
-- Run this as Entra admin against bhs_dev database

SECURITY LABEL FOR "pgaadauth" ON ROLE "bhs-api-dam"
  IS 'aadauth,oid=debf1bc2-f14a-4eab-80e6-d38824a3bceb,type=service';

GRANT CONNECT ON DATABASE bhs_dev TO "bhs-api-dam"; -- actual DB name is bhs_dev (not bhsdb)
GRANT USAGE ON SCHEMA public TO "bhs-api-dam";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "bhs-api-dam";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "bhs-api-dam";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "bhs-api-dam";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO "bhs-api-dam";

-- Verify
SELECT r.rolname, sl.label
FROM pg_roles r
LEFT JOIN pg_seclabels sl ON sl.objoid = r.oid AND sl.provider = 'pgaadauth'
WHERE r.rolname = 'bhs-api-dam';
