\set ON_ERROR_STOP on
INSERT INTO workspaces (id, name, slug) VALUES
  ('00000000-0000-4000-8000-000000000001', 'Tenant One', 'tenant-one'),
  ('00000000-0000-4000-8000-000000000002', 'Tenant Two', 'tenant-two')
ON CONFLICT (id) DO NOTHING;

SET ROLE anycol_app;
SELECT set_config('app.workspace_id', '00000000-0000-4000-8000-000000000001', false);
SELECT 1 / CASE WHEN count(*) = 1 THEN 1 ELSE 0 END AS tenant_isolation_verified FROM workspaces;
RESET ROLE;
