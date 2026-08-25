create schema if not exists eventing;

create table if not exists eventing.outbox_events (
  event_id uuid primary key,
  event_type text not null,
  schema_version integer not null check (schema_version > 0),
  aggregate_type text not null,
  aggregate_id uuid not null,
  aggregate_version integer not null check (aggregate_version > 0),
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default clock_timestamp(),
  correlation_id text not null,
  causation_id text,
  actor_user_id uuid,
  seller_account_id uuid,
  owner_module text not null,
  data_classification text not null check (data_classification in ('PUBLIC','INTERNAL','CONFIDENTIAL','FINANCIAL')),
  payload jsonb not null,
  publication_status text not null default 'PENDING' check (publication_status in ('PENDING','PUBLISHED','DEAD_LETTER')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  lease_owner text,
  lease_until timestamptz,
  published_at timestamptz,
  last_error_code text,
  constraint outbox_events_aggregate_version_uidx unique (aggregate_type, aggregate_id, aggregate_version, event_type),
  constraint outbox_events_publication_consistency_chk check (
    (publication_status = 'PUBLISHED' and published_at is not null) or publication_status <> 'PUBLISHED'
  )
);

create index if not exists outbox_events_publication_status_recorded_at_idx
  on eventing.outbox_events (publication_status, recorded_at, event_id);

create table if not exists eventing.inbox_receipts (
  consumer_id text not null,
  event_id uuid not null,
  processed_at timestamptz not null default clock_timestamp(),
  primary key (consumer_id, event_id)
);

create table if not exists eventing.idempotency_records (
  operation_id text not null,
  scope_hash text not null,
  idempotency_key_hash text not null,
  request_hash text not null,
  response_status integer,
  response_body jsonb,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  primary key (operation_id, scope_hash, idempotency_key_hash),
  constraint idempotency_records_expiry_chk check (expires_at > created_at)
);
