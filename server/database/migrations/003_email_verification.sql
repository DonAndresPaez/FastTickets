ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMPTZ;

-- one active code per user, a new code replaces the old one
CREATE TABLE verification_codes (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
