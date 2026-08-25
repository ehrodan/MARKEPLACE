create schema if not exists sellers;

create table if not exists sellers.seller_accounts (
  seller_account_id uuid primary key,
  display_name varchar(120) not null,
  account_type text not null check (account_type in ('INDIVIDUAL','ORGANIZATION')),
  seller_account_status text not null check (seller_account_status in ('ONBOARDING_REQUIRED','ACTIVE','SUSPENDED')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create table if not exists sellers.seller_memberships (
  seller_membership_id uuid primary key,
  seller_account_id uuid not null references sellers.seller_accounts(seller_account_id),
  user_id uuid not null references identity.users(user_id),
  membership_role text not null check (membership_role in ('OWNER','MANAGER','OPERATOR','FINANCE_VIEWER')),
  membership_status text not null check (membership_status in ('ACTIVE','REVOKED','EXPIRED')),
  valid_from timestamptz not null,
  valid_until timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint seller_memberships_validity_chk check (valid_until is null or valid_until > valid_from)
);
create unique index if not exists seller_memberships_seller_account_id_user_id_active_uidx
  on sellers.seller_memberships (seller_account_id, user_id) where membership_status = 'ACTIVE';
create index if not exists seller_memberships_seller_account_id_status_idx
  on sellers.seller_memberships (seller_account_id, membership_status);
create index if not exists seller_memberships_user_id_status_idx
  on sellers.seller_memberships (user_id, membership_status);

create table if not exists sellers.seller_membership_grants (
  grant_id uuid primary key,
  seller_account_id uuid not null references sellers.seller_accounts(seller_account_id),
  seller_membership_id uuid not null references sellers.seller_memberships(seller_membership_id),
  permission_code text not null references iam.permissions(permission_code),
  effect text not null check (effect in ('ALLOW','DENY')),
  valid_until timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  constraint seller_membership_grants_membership_permission_uidx unique (seller_membership_id, permission_code)
);
create index if not exists seller_membership_grants_seller_account_id_idx
  on sellers.seller_membership_grants (seller_account_id);

create or replace function sellers.enforce_membership_grant_tenant()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from sellers.seller_memberships membership
    where membership.seller_membership_id = new.seller_membership_id
      and membership.seller_account_id = new.seller_account_id
  ) then
    raise exception 'membership grant tenant mismatch' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists seller_membership_grants_tenant_trigger on sellers.seller_membership_grants;
create trigger seller_membership_grants_tenant_trigger
before insert or update on sellers.seller_membership_grants
for each row execute function sellers.enforce_membership_grant_tenant();
