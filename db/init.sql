DROP TABLE IF EXISTS events;

CREATE TABLE IF NOT EXISTS events (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  "title" VARCHAR(50) NOT NULL,
  "description" TEXT NULL,
  "when" DATE NULL,
  "longitude" DECIMAL(9, 6) NULL,
  "latitude" DECIMAL(8, 6) NULL,
  "showcase_image" VARCHAR(255) NULL,
  "donation_requested" SMALLINT DEFAULT 0,
  "donation_amount" REAL NULL,
  "payment_required" SMALLINT DEFAULT 0,
  "payment_amount" REAL NULL
);

DROP TABLE IF EXISTS users;

CREATE TABLE IF NOT EXISTS users (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  "username" VARCHAR(50) UNIQUE NOT NULL,
  "email" VARCHAR(100) UNIQUE NOT NULL,
  "password_hash" VARCHAR(256) NOT NULL,
  "password_salt" VARCHAR(256) NOT NULL,
  "is_admin" BOOLEAN DEFAULT FALSE,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO
  users (username, email, password_hash, password_salt)
VALUES
  (
    'admin',
    'admin@matthewfrankland.co.uk',
    '2538a5eec9c7dae00979d74645278f139a997f147b7fa5d30db904322d9d5c8699b09ee3138f0bbfb1b187caab5e9295b793d8cc67f6a0750c00f89498874a2a',
    '2787bf091789b29204886d52d5b1e37cfa69dc179f7f83c551487ec5356252db'
  );