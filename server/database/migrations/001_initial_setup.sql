-- Shared setup used by later migrations.
-- Each subsystem's tables go in their own file (002_create_users.sql, etc).

-- case-insensitive text type, used for emails
CREATE EXTENSION IF NOT EXISTS citext;

-- keeps updated_at current on every UPDATE. To use it on a table:
-- CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
--   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
