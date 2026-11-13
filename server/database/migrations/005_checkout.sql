-- credits used to buy tickets, everyone starts with $500
ALTER TABLE users ADD COLUMN balance NUMERIC(10, 2) NOT NULL DEFAULT 500 CHECK (balance >= 0);

ALTER TABLE tickets ADD CONSTRAINT tickets_quantity_not_negative CHECK (quantity >= 0);

CREATE TABLE orders (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

CREATE INDEX orders_user_id_idx ON orders (user_id);

-- the ticket details are copied here instead of pointing at tickets(id),
-- because db:load deletes and re-creates the tickets rows
CREATE TABLE order_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  race_id INTEGER NOT NULL REFERENCES race(id),
  event_day DATE NOT NULL,
  section TEXT NOT NULL,
  "row" TEXT,
  location TEXT NOT NULL,
  unit_price NUMERIC(10, 2) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0));

CREATE INDEX order_items_order_id_idx ON order_items (order_id);
