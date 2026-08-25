create schema if not exists finance;

insert into iam.permissions (permission_code, description) values
  ('finance.payments.resolve', 'Abrir caso de resolução de pagamento'),
  ('finance.payments.review', 'Decidir caso de resolução de pagamento'),
  ('finance.payouts.read', 'Ler fila administrativa de saques'),
  ('finance.payouts.claim', 'Assumir revisão de solicitação de saque'),
  ('finance.payouts.approve', 'Aprovar solicitação de saque revisada'),
  ('finance.payouts.execute', 'Registrar execução homologada de saque'),
  ('finance.payouts.confirm', 'Confirmar saque por consulta reconciliada')
on conflict (permission_code) do nothing;

create table if not exists finance.order_financial_states (
  order_id uuid primary key,
  buyer_user_id uuid not null references identity.users(user_id),
  seller_account_id uuid not null references sellers.seller_accounts(seller_account_id),
  fulfillment_status text not null check (fulfillment_status in ('CREATED','PROCESSING','COMPLETED','CANCELLED')),
  dispute_open boolean not null default false,
  chargeback_open boolean not null default false,
  account_frozen boolean not null default false,
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default clock_timestamp()
);

create table if not exists finance.payments (
  payment_id uuid primary key,
  order_id uuid not null references finance.order_financial_states(order_id),
  buyer_user_id uuid not null references identity.users(user_id),
  seller_account_id uuid not null references sellers.seller_accounts(seller_account_id),
  provider_code text,
  provider_payment_reference text,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  payment_status text not null check (payment_status in ('PENDING','SETTLED','FAILED','CANCELLED','PAYMENT_QUARANTINED')),
  reconciliation_status text not null check (reconciliation_status in ('PENDING','RECONCILED_PROVIDER','RECONCILED_MANUAL')),
  settled_at timestamptz,
  reconciled_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_by_user_id uuid references identity.users(user_id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint payments_provider_reference_pair_chk check (
    (provider_code is null and provider_payment_reference is null)
    or (provider_code is not null and provider_payment_reference is not null)
  ),
  constraint payments_settlement_consistency_chk check (
    (payment_status = 'SETTLED' and settled_at is not null and reconciled_at is not null and reconciliation_status <> 'PENDING')
    or (payment_status <> 'SETTLED' and settled_at is null)
  )
);
create unique index if not exists payments_provider_reference_uidx
  on finance.payments (provider_code, provider_payment_reference)
  where provider_code is not null and provider_payment_reference is not null;
create index if not exists payments_buyer_created_idx on finance.payments (buyer_user_id, created_at desc);
create index if not exists payments_seller_created_idx on finance.payments (seller_account_id, created_at desc);

create table if not exists finance.payment_state_transitions (
  transition_id uuid primary key,
  payment_id uuid not null references finance.payments(payment_id),
  from_status text,
  to_status text not null,
  transition_source text not null check (transition_source in ('ORDER_COMMAND','PROVIDER_VERIFIED','PROVIDER_LOOKUP','MANUAL_RESOLUTION')),
  source_reference text not null,
  actor_user_id uuid references identity.users(user_id),
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default clock_timestamp()
);
create unique index if not exists payment_state_transitions_settled_once_uidx
  on finance.payment_state_transitions (payment_id) where to_status = 'SETTLED';

create table if not exists finance.provider_event_inbox (
  provider_event_id uuid primary key,
  provider_code text not null,
  external_event_id text not null,
  payload_sha256 char(64) not null,
  provider_payment_reference text not null,
  payment_id uuid references finance.payments(payment_id),
  processing_result text not null check (processing_result in ('SETTLED','PAYMENT_QUARANTINED','IGNORED_PENDING','IGNORED_FAILED','PAYMENT_NOT_FOUND')),
  provider_occurred_at timestamptz not null,
  verified_at timestamptz not null,
  recorded_at timestamptz not null default clock_timestamp(),
  constraint provider_event_inbox_delivery_uidx unique (provider_code, external_event_id)
);

create table if not exists finance.provider_reconciliations (
  reconciliation_id uuid primary key,
  payment_id uuid not null references finance.payments(payment_id),
  provider_code text not null,
  provider_reconciliation_reference text not null,
  provider_state text not null,
  provider_occurred_at timestamptz not null,
  recorded_at timestamptz not null default clock_timestamp(),
  constraint provider_reconciliations_reference_uidx unique (provider_code, provider_reconciliation_reference)
);

create table if not exists finance.payment_quarantines (
  payment_quarantine_id uuid primary key,
  payment_id uuid not null references finance.payments(payment_id),
  provider_code text not null,
  provider_reference text not null,
  provider_event_reference text not null,
  reason_code text not null check (reason_code in ('LATE_SETTLEMENT_ORDER_CANCELLED')),
  provider_settled_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint payment_quarantines_provider_event_uidx unique (provider_code, provider_event_reference),
  constraint payment_quarantines_payment_uidx unique (payment_id)
);

create table if not exists finance.payment_resolution_cases (
  resolution_case_id uuid primary key,
  payment_id uuid not null references finance.payments(payment_id),
  case_status text not null check (case_status in ('OPEN','APPROVED','REJECTED')),
  reason_code text not null,
  evidence_locator text not null,
  created_by_user_id uuid not null references identity.users(user_id),
  reviewed_by_user_id uuid references identity.users(user_id),
  review_reason text,
  created_at timestamptz not null default clock_timestamp(),
  reviewed_at timestamptz,
  version integer not null default 1 check (version > 0),
  constraint payment_resolution_cases_review_consistency_chk check (
    (case_status = 'OPEN' and reviewed_by_user_id is null and reviewed_at is null and review_reason is null)
    or (case_status <> 'OPEN' and reviewed_by_user_id is not null and reviewed_at is not null and review_reason is not null)
  ),
  constraint payment_resolution_cases_sod_chk check (reviewed_by_user_id is null or reviewed_by_user_id <> created_by_user_id)
);
create unique index if not exists payment_resolution_cases_open_payment_uidx
  on finance.payment_resolution_cases (payment_id) where case_status = 'OPEN';

create table if not exists finance.payment_resolution_case_history (
  history_id uuid primary key,
  resolution_case_id uuid not null references finance.payment_resolution_cases(resolution_case_id),
  case_status text not null,
  actor_user_id uuid not null references identity.users(user_id),
  reason text not null,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default clock_timestamp()
);

create table if not exists finance.ledger_accounts (
  ledger_account_id uuid primary key,
  account_code text not null unique,
  seller_account_id uuid references sellers.seller_accounts(seller_account_id),
  account_type text not null check (account_type in ('PROVIDER_CLEARING','SELLER_PAYABLE_HELD','SELLER_PAYABLE_AVAILABLE','PAYOUT_CLEARING')),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default clock_timestamp()
);

create table if not exists finance.ledger_journals (
  journal_id uuid primary key,
  journal_type text not null check (journal_type in ('PAYMENT_SETTLEMENT','HOLD_RELEASE','PAYOUT_COMPLETION')),
  reference_id uuid not null,
  seller_account_id uuid not null references sellers.seller_accounts(seller_account_id),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  correlation_id text not null,
  actor_user_id uuid references identity.users(user_id),
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default clock_timestamp(),
  constraint ledger_journals_reference_uidx unique (journal_type, reference_id)
);

create table if not exists finance.ledger_entries (
  ledger_entry_id uuid primary key,
  journal_id uuid not null references finance.ledger_journals(journal_id),
  ledger_account_id uuid not null references finance.ledger_accounts(ledger_account_id),
  entry_sequence smallint not null check (entry_sequence > 0),
  amount_minor bigint not null check (amount_minor <> 0),
  created_at timestamptz not null default clock_timestamp(),
  constraint ledger_entries_journal_sequence_uidx unique (journal_id, entry_sequence)
);

create or replace function finance.assert_journal_balanced()
returns trigger
language plpgsql
as $$
declare
  checked_journal_id uuid;
  entry_count integer;
  entry_sum numeric;
begin
  checked_journal_id := coalesce(new.journal_id, old.journal_id);
  select count(*)::integer, coalesce(sum(amount_minor), 0)
    into entry_count, entry_sum
    from finance.ledger_entries
   where journal_id = checked_journal_id;
  if entry_count < 2 or entry_sum <> 0 then
    raise exception 'ledger journal % is not balanced', checked_journal_id using errcode = '23514';
  end if;
  return null;
end;
$$;

drop trigger if exists ledger_entries_balance_trigger on finance.ledger_entries;
create constraint trigger ledger_entries_balance_trigger
after insert or update or delete on finance.ledger_entries
deferrable initially deferred
for each row execute function finance.assert_journal_balanced();

create table if not exists finance.balance_lots (
  balance_lot_id uuid primary key,
  payment_id uuid not null unique references finance.payments(payment_id),
  seller_account_id uuid not null references sellers.seller_accounts(seller_account_id),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  original_amount_minor bigint not null check (original_amount_minor > 0),
  remaining_amount_minor bigint not null check (remaining_amount_minor >= 0),
  reserved_amount_minor bigint not null default 0 check (reserved_amount_minor >= 0),
  lot_status text not null check (lot_status in ('HELD','AVAILABLE','CONSUMED','FROZEN')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint balance_lots_amounts_chk check (
    reserved_amount_minor <= remaining_amount_minor and remaining_amount_minor <= original_amount_minor
  )
);
create index if not exists balance_lots_seller_status_idx
  on finance.balance_lots (seller_account_id, currency, lot_status, created_at);

create table if not exists finance.holds (
  hold_id uuid primary key,
  balance_lot_id uuid not null unique references finance.balance_lots(balance_lot_id),
  hold_status text not null check (hold_status in ('ACTIVE','RELEASED','BLOCKED')),
  starts_at timestamptz not null,
  eligible_at timestamptz not null,
  released_at timestamptz,
  release_journal_id uuid references finance.ledger_journals(journal_id),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint holds_exact_window_chk check (eligible_at = starts_at + interval '168 hours'),
  constraint holds_release_consistency_chk check (
    (hold_status = 'RELEASED' and released_at is not null and release_journal_id is not null)
    or (hold_status <> 'RELEASED' and released_at is null and release_journal_id is null)
  )
);
create index if not exists holds_status_eligible_idx on finance.holds (hold_status, eligible_at);

create table if not exists finance.hold_state_transitions (
  transition_id uuid primary key,
  hold_id uuid not null references finance.holds(hold_id),
  from_status text,
  to_status text not null,
  reason_code text not null,
  actor_user_id uuid references identity.users(user_id),
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default clock_timestamp()
);

create table if not exists finance.payout_requests (
  payout_request_id uuid primary key,
  seller_account_id uuid not null references sellers.seller_accounts(seller_account_id),
  requested_by_user_id uuid not null references identity.users(user_id),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  destination_country char(2) not null check (destination_country ~ '^[A-Z]{2}$'),
  idempotency_key_hash char(64) not null,
  payout_status text not null check (payout_status in (
    'REQUESTED','UNDER_REVIEW','INFORMATION_REQUIRED','APPROVED','REJECTED',
    'EXECUTING','CONFIRMATION_PENDING','PAID','FAILED','RETURNED','CANCELED'
  )),
  claimed_by_user_id uuid references identity.users(user_id),
  approved_by_user_id uuid references identity.users(user_id),
  completed_by_user_id uuid references identity.users(user_id),
  claimed_at timestamptz,
  approved_at timestamptz,
  completed_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint payout_requests_idempotency_uidx unique (seller_account_id, idempotency_key_hash),
  constraint payout_requests_claim_consistency_chk check (
    (payout_status = 'REQUESTED' and claimed_by_user_id is null and claimed_at is null)
    or (payout_status <> 'REQUESTED' and claimed_by_user_id is not null and claimed_at is not null)
  ),
  constraint payout_requests_approval_consistency_chk check (
    (payout_status in ('REQUESTED','UNDER_REVIEW','INFORMATION_REQUIRED','REJECTED','CANCELED') and approved_by_user_id is null and approved_at is null)
    or (payout_status in ('APPROVED','EXECUTING','CONFIRMATION_PENDING','PAID','FAILED','RETURNED') and approved_by_user_id is not null and approved_at is not null)
  ),
  constraint payout_requests_complete_consistency_chk check (
    (payout_status = 'PAID' and completed_by_user_id is not null and completed_at is not null)
    or (payout_status <> 'PAID' and completed_by_user_id is null and completed_at is null)
  ),
  constraint payout_requests_creator_sod_chk check (completed_by_user_id is null or completed_by_user_id <> requested_by_user_id),
  constraint payout_requests_reviewer_sod_chk check (completed_by_user_id is null or completed_by_user_id <> claimed_by_user_id),
  constraint payout_requests_approver_sod_chk check (completed_by_user_id is null or completed_by_user_id <> approved_by_user_id)
);
create index if not exists payout_requests_queue_idx on finance.payout_requests (payout_status, created_at);
create index if not exists payout_requests_seller_idx on finance.payout_requests (seller_account_id, created_at desc);

create table if not exists finance.payout_request_lots (
  payout_request_id uuid not null references finance.payout_requests(payout_request_id),
  balance_lot_id uuid not null references finance.balance_lots(balance_lot_id),
  allocated_amount_minor bigint not null check (allocated_amount_minor > 0),
  primary key (payout_request_id, balance_lot_id)
);

create table if not exists finance.payout_attempts (
  payout_attempt_id uuid primary key,
  payout_request_id uuid not null references finance.payout_requests(payout_request_id),
  attempt_number integer not null check (attempt_number > 0),
  execution_mode text not null check (execution_mode in ('EXTERNAL_MANUAL')),
  attempt_status text not null check (attempt_status in ('SUBMITTED','CONFIRMATION_PENDING','PAID','FAILED','RETURNED')),
  external_reference text not null,
  idempotency_key_hash char(64) not null,
  executed_by_user_id uuid not null references identity.users(user_id),
  executed_at timestamptz not null,
  recorded_at timestamptz not null default clock_timestamp(),
  constraint payout_attempts_number_uidx unique (payout_request_id, attempt_number),
  constraint payout_attempts_idempotency_uidx unique (payout_request_id, idempotency_key_hash)
);

create table if not exists finance.payout_evidence (
  payout_evidence_id uuid primary key,
  payout_attempt_id uuid not null references finance.payout_attempts(payout_attempt_id),
  evidence_locator text not null,
  evidence_sha256 char(64) not null,
  recorded_by_user_id uuid not null references identity.users(user_id),
  recorded_at timestamptz not null default clock_timestamp()
);

create table if not exists finance.payout_confirmations (
  payout_confirmation_id uuid primary key,
  payout_attempt_id uuid not null unique references finance.payout_attempts(payout_attempt_id),
  confirmation_reference text not null unique,
  evidence_locator text not null,
  evidence_sha256 char(64) not null,
  idempotency_key_hash char(64) not null,
  confirmed_by_user_id uuid not null references identity.users(user_id),
  provider_confirmed_at timestamptz not null,
  recorded_at timestamptz not null default clock_timestamp()
);

create table if not exists finance.payout_state_transitions (
  transition_id uuid primary key,
  payout_request_id uuid not null references finance.payout_requests(payout_request_id),
  from_status text,
  to_status text not null,
  reason_code text not null,
  actor_user_id uuid not null references identity.users(user_id),
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default clock_timestamp()
);

create or replace function finance.reject_append_only_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '55000';
end;
$$;

do $$
declare
  append_table text;
begin
  foreach append_table in array array[
    'payment_state_transitions',
    'provider_event_inbox',
    'provider_reconciliations',
    'payment_quarantines',
    'payment_resolution_case_history',
    'ledger_journals',
    'ledger_entries',
    'hold_state_transitions',
    'payout_attempts',
    'payout_evidence',
    'payout_confirmations',
    'payout_state_transitions'
  ]
  loop
    execute format('drop trigger if exists %I_append_only_trigger on finance.%I', append_table, append_table);
    execute format(
      'create trigger %I_append_only_trigger before update or delete on finance.%I for each row execute function finance.reject_append_only_mutation()',
      append_table,
      append_table
    );
  end loop;
end;
$$;
