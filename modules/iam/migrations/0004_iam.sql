create schema if not exists iam;

create table if not exists iam.permissions (
  permission_code text primary key,
  description text not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint permissions_code_chk check (permission_code ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$')
);

create table if not exists iam.roles (
  role_id uuid primary key,
  role_code text not null,
  role_scope text not null check (role_scope in ('PLATFORM','SELLER_ACCOUNT')),
  version text not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint roles_role_code_version_uidx unique (role_code, version)
);

create table if not exists iam.role_permissions (
  role_id uuid not null references iam.roles(role_id),
  permission_code text not null references iam.permissions(permission_code),
  primary key (role_id, permission_code)
);

create table if not exists iam.user_role_assignments (
  assignment_id uuid primary key,
  user_id uuid not null references identity.users(user_id),
  role_id uuid not null references iam.roles(role_id),
  assignment_status text not null check (assignment_status in ('ACTIVE','REVOKED','EXPIRED')),
  valid_from timestamptz not null,
  valid_until timestamptz,
  constraint user_role_assignments_validity_chk check (valid_until is null or valid_until > valid_from)
);

insert into iam.permissions (permission_code, description) values
  ('seller.account.read', 'Ler a conta vendedora autorizada'),
  ('seller.members.read', 'Listar membros da conta vendedora autorizada')
on conflict (permission_code) do nothing;
