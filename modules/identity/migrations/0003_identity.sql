create schema if not exists identity;

create table if not exists identity.users (
  user_id uuid primary key,
  email_normalized varchar(320) not null,
  display_name varchar(100) not null,
  user_status text not null check (user_status in ('PENDING_VERIFICATION','ACTIVE','SUSPENDED')),
  accepted_terms_version varchar(64) not null,
  accepted_terms_at timestamptz not null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint users_email_normalized_uidx unique (email_normalized)
);

create table if not exists identity.credentials (
  credential_id uuid primary key,
  user_id uuid not null references identity.users(user_id),
  credential_type text not null check (credential_type in ('PASSWORD')),
  password_hash text not null,
  created_at timestamptz not null default clock_timestamp(),
  retired_at timestamptz
);
create unique index if not exists credentials_user_id_credential_type_active_uidx
  on identity.credentials (user_id, credential_type) where retired_at is null;

create table if not exists identity.email_verification_challenges (
  challenge_id uuid primary key,
  user_id uuid not null references identity.users(user_id),
  token_hash char(64) not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  invalidated_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  constraint email_verification_challenges_token_hash_uidx unique (token_hash),
  constraint email_verification_challenges_expiry_chk check (expires_at > created_at),
  constraint email_verification_challenges_terminal_chk check (consumed_at is null or invalidated_at is null)
);
create index if not exists email_verification_challenges_user_id_created_at_idx
  on identity.email_verification_challenges (user_id, created_at desc);

create table if not exists identity.sessions (
  session_id uuid primary key,
  user_id uuid not null references identity.users(user_id),
  token_hash char(64) not null,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_seen_at timestamptz not null,
  constraint sessions_token_hash_uidx unique (token_hash),
  constraint sessions_expiry_chk check (expires_at > created_at)
);
create index if not exists sessions_user_id_created_at_idx
  on identity.sessions (user_id, created_at desc);

create table if not exists identity.auth_rate_limits (
  rate_limit_key_hash char(64) primary key,
  window_started_at timestamptz not null,
  attempt_count integer not null check (attempt_count > 0),
  updated_at timestamptz not null
);
