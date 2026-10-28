-- 이 과제 전용 스키마. 다른 스키마(첫 과제 등)는 건드리지 않는다.
-- 모든 문장은 여러 번 실행해도 안전하다.
CREATE SCHEMA IF NOT EXISTS photo_studio;

CREATE TABLE IF NOT EXISTS photo_studio.admins (
  id            serial PRIMARY KEY,
  login_id      varchar(20) NOT NULL UNIQUE,
  password_hash text        NOT NULL,
  name          varchar(20) NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS photo_studio.shoot_types (
  id           serial PRIMARY KEY,
  name         varchar(30)  NOT NULL,
  description  varchar(200),
  duration_min integer      NOT NULL CHECK (duration_min > 0 AND duration_min % 30 = 0),
  price        integer      NOT NULL CHECK (price >= 0),
  is_active    boolean      NOT NULL DEFAULT true,
  created_at   timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS photo_studio.customers (
  id            serial PRIMARY KEY,
  name          varchar(20) NOT NULL,
  phone         varchar(11) NOT NULL,
  login_id      varchar(20),
  password_hash text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customers_phone_key UNIQUE (phone),
  CONSTRAINT customers_login_id_key UNIQUE (login_id)
);

CREATE TABLE IF NOT EXISTS photo_studio.reservations (
  id               serial PRIMARY KEY,
  customer_id      integer     NOT NULL REFERENCES photo_studio.customers (id) ON DELETE CASCADE,
  shoot_type_id    integer     NOT NULL REFERENCES photo_studio.shoot_types (id),
  start_at         timestamptz NOT NULL,
  end_at           timestamptz NOT NULL,
  headcount        integer     NOT NULL CHECK (headcount BETWEEN 1 AND 10),
  purpose          varchar(30),
  special_request  varchar(300),
  channel          varchar(20) NOT NULL DEFAULT 'online'
                   CHECK (channel IN ('online', 'phone', 'visit', 'instagram', 'other')),
  terms_agreed_at  timestamptz,
  price_at_booking integer     NOT NULL,
  status           varchar(30) NOT NULL DEFAULT 'confirmed'
                   CHECK (status IN ('confirmed', 'cancelled_by_customer', 'cancelled_by_admin',
                                     'changed', 'completed', 'no_show')),
  changed_from_id  integer     REFERENCES photo_studio.reservations (id) ON DELETE SET NULL,
  cancelled_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS reservations_start_at_idx ON photo_studio.reservations (start_at);
CREATE INDEX IF NOT EXISTS reservations_customer_id_idx ON photo_studio.reservations (customer_id);

-- 확정된 예약끼리는 시간이 겹칠 수 없다 (동시에 눌러도 한 건만 저장됨)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE c.conname = 'reservations_no_overlap' AND n.nspname = 'photo_studio'
  ) THEN
    ALTER TABLE photo_studio.reservations
      ADD CONSTRAINT reservations_no_overlap
      EXCLUDE USING gist (tstzrange(start_at, end_at, '[)') WITH &&)
      WHERE (status = 'confirmed');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS photo_studio.ai_notes (
  id             serial PRIMARY KEY,
  reservation_id integer      NOT NULL UNIQUE REFERENCES photo_studio.reservations (id) ON DELETE CASCADE,
  status         varchar(10)  NOT NULL CHECK (status IN ('done', 'failed', 'no_key')),
  content        jsonb,
  one_line       varchar(200),
  generated_at   timestamptz  NOT NULL DEFAULT now()
);
