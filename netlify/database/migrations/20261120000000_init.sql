CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workos_user_id text NOT NULL UNIQUE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  invite_code text NOT NULL UNIQUE CHECK (invite_code ~ '^[A-Z0-9]{8}$'),
  signup_deadline timestamptz NOT NULL,
  raffled_at timestamptz,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 40),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE UNIQUE INDEX memberships_group_display_name_key
  ON memberships (group_id, lower(display_name));

CREATE INDEX memberships_user_id_idx ON memberships (user_id);

CREATE TABLE assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  giver_membership_id uuid NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  receiver_membership_id uuid NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  revealed_at timestamptz,
  UNIQUE (group_id, giver_membership_id),
  UNIQUE (group_id, receiver_membership_id),
  CHECK (giver_membership_id <> receiver_membership_id)
);
