create schema if not exists audit;

create table if not exists audit.audit_events (
  audit_event_id uuid primary key,
  occurred_at timestamptz not null,
  actor_user_id uuid,
  acting_role text,
  session_id_hash text,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  authorization_decision_id text,
  policy_version text,
  before_redacted jsonb,
  after_redacted jsonb,
  reason_code text,
  correlation_id text not null,
  ip_prefix text,
  user_agent_family text,
  seller_account_id uuid,
  data_classification text not null check (data_classification in ('INTERNAL','CONFIDENTIAL','FINANCIAL')),
  recorded_at timestamptz not null default clock_timestamp()
);

create index if not exists audit_events_resource_idx
  on audit.audit_events (resource_type, resource_id, occurred_at desc);
create index if not exists audit_events_actor_user_id_idx
  on audit.audit_events (actor_user_id, occurred_at desc);

create or replace function audit.reject_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_events is append-only' using errcode = '55000';
end;
$$;

drop trigger if exists audit_events_append_only_trigger on audit.audit_events;
create trigger audit_events_append_only_trigger
before update or delete on audit.audit_events
for each row execute function audit.reject_audit_mutation();
