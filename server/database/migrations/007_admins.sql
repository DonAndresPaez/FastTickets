-- admins are kept apart from users: they never sign up, have no balance or cart,
-- and are created by npm run db:seed-admins
CREATE TABLE admins (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

CREATE UNIQUE INDEX admins_email_unique ON admins (LOWER(email));
