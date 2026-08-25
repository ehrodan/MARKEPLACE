create schema if not exists catalog;

-- Tabela base de itens do catálogo (armas, skins, itens digitais)
create table if not exists catalog.catalog_items (
  catalog_item_id uuid primary key,
  public_slug text not null unique,
  display_name text not null,
  description text,
  game_origin text not null,
  item_type text not null check (item_type in ('WEAPON','SKIN','STICKER','KEY','CASE','OTHER')),
  rarity text check (rarity in ('COMMON','UNCOMMON','RARE','EPIC','LEGENDARY','MYTHIC','CONTRABAND')),
  craft_quality text check (craft_quality in ('FACTORY_NEW','MINIMAL_WEAR','FIELD_TESTED','WELL_WORN','BATTLE_SCARRED')),
  metadata jsonb not null default '{}'::jsonb,
  tombstoned_at timestamptz,
  tombstone_reason text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create index if not exists catalog_items_game_origin_idx on catalog.catalog_items (game_origin);
create index if not exists catalog_items_item_type_idx on catalog.catalog_items (item_type);
create index if not exists catalog_items_active_idx on catalog.catalog_items (tombstoned_at) where tombstoned_at is null;

-- Assets 2D/3D vinculados a itens
create table if not exists catalog.catalog_assets (
  catalog_asset_id uuid primary key,
  catalog_item_id uuid not null references catalog.catalog_items(catalog_item_id) on delete cascade,
  asset_type text not null check (asset_type in ('POSTER_2D','MODEL_3D_GLB','MULTI_VIEW','SINGLE_VIEW')),
  storage_uri text not null,
  storage_provider text not null check (storage_provider in ('MINIO','S3','LOCAL')),
  file_size_bytes bigint not null check (file_size_bytes >= 0),
  mime_type text not null,
  width_pixels integer,
  height_pixels integer,
  is_primary boolean not null default false,
  approval_status text not null default 'PENDING' check (approval_status in ('PENDING','APPROVED','REJECTED','QUARANTINED')),
  approved_by_user_id uuid,
  approved_at timestamptz,
  rejection_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp()
);

create unique index if not exists catalog_assets_primary_per_item_uidx
  on catalog.catalog_assets (catalog_item_id) where is_primary = true;

create index if not exists catalog_assets_item_idx on catalog.catalog_assets (catalog_item_id);
create index if not exists catalog_assets_approval_idx on catalog.catalog_assets (approval_status);

-- Planos de destaque (Básico, VIP, Premium)
create table if not exists catalog.listing_plans (
  listing_plan_id uuid primary key,
  plan_code text not null unique check (plan_code in ('BASIC','VIP','PREMIUM')),
  display_name text not null,
  platform_fee_rate numeric(5,4) not null check (platform_fee_rate >= 0 and platform_fee_rate < 1),
  psp_fee_rate numeric(5,4) not null check (psp_fee_rate >= 0 and psp_fee_rate < 1),
  exposure_priority integer not null check (exposure_priority >= 0),
  queue_priority integer not null default 0 check (queue_priority >= 0),
  benefits jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  valid_from timestamptz not null,
  valid_until timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  constraint listing_plans_validity_chk check (valid_until is null or valid_until > valid_from)
);

-- Anúncios (listings) publicados por sellers
create table if not exists catalog.listings (
  listing_id uuid primary key,
  public_slug text not null unique,
  catalog_item_id uuid not null references catalog.catalog_items(catalog_item_id),
  seller_account_id uuid not null,
  listing_plan_id uuid not null references catalog.listing_plans(listing_plan_id),
  listing_status text not null default 'DRAFT' check (listing_status in ('DRAFT','REVIEW','PUBLISHED','PAUSED','SOLD','TOMBSTONE')),
  price_minor bigint not null check (price_minor >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  quantity_available integer not null default 1 check (quantity_available >= 0),
  quantity_sold integer not null default 0 check (quantity_sold >= 0),
  condition_notes text,
  metadata jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  paused_at timestamptz,
  tombstoned_at timestamptz,
  tombstone_reason text,
  version integer not null default 1,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create index if not exists listings_seller_idx on catalog.listings (seller_account_id);
create index if not exists listings_item_idx on catalog.listings (catalog_item_id);
create index if not exists listings_status_idx on catalog.listings (listing_status);
create index if not exists listings_published_idx on catalog.listings (published_at) where listing_status = 'PUBLISHED';
create index if not exists listings_active_idx on catalog.listings (listing_status) where listing_status in ('DRAFT','REVIEW','PUBLISHED','PAUSED');

-- Revisões de anúncio (histórico de mudanças)
create table if not exists catalog.listing_revisions (
  listing_revision_id uuid primary key,
  listing_id uuid not null references catalog.listings(listing_id) on delete cascade,
  revision_number integer not null check (revision_number > 0),
  price_minor bigint not null check (price_minor >= 0),
  currency char(3) not null,
  quantity_available integer not null check (quantity_available >= 0),
  condition_notes text,
  metadata jsonb not null default '{}'::jsonb,
  changed_by_user_id uuid not null,
  change_reason text,
  created_at timestamptz not null default clock_timestamp(),
  constraint listing_revisions_number_uidx unique (listing_id, revision_number)
);

create index if not exists listing_revisions_listing_idx on catalog.listing_revisions (listing_id);

-- Snapshot comercial congelado no momento da publicação
create table if not exists catalog.listing_commercial_snapshots (
  snapshot_id uuid primary key,
  listing_id uuid not null references catalog.listings(listing_id),
  listing_plan_id uuid not null references catalog.listing_plans(listing_plan_id),
  plan_code text not null,
  platform_fee_rate numeric(5,4) not null,
  psp_fee_rate numeric(5,4) not null,
  exposure_priority integer not null,
  price_minor bigint not null check (price_minor >= 0),
  currency char(3) not null,
  quantity_available integer not null check (quantity_available >= 0),
  benefits jsonb not null default '{}'::jsonb,
  snapshot_at timestamptz not null default clock_timestamp(),
  constraint listing_commercial_snapshots_listing_uidx unique (listing_id)
);

create index if not exists listing_snapshots_listing_idx on catalog.listing_commercial_snapshots (listing_id);

-- Taxonomia de categorias (opcional, para filtros)
create table if not exists catalog.categories (
  category_id uuid primary key,
  parent_category_id uuid references catalog.categories(category_id),
  slug text not null unique,
  display_name text not null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists categories_parent_idx on catalog.categories (parent_category_id);

-- Relacionamento item-categoria (muitos-para-muitos)
create table if not exists catalog.item_categories (
  catalog_item_id uuid not null references catalog.catalog_items(catalog_item_id) on delete cascade,
  category_id uuid not null references catalog.categories(category_id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  primary key (catalog_item_id, category_id)
);

create unique index if not exists item_categories_primary_per_item_uidx
  on catalog.item_categories (catalog_item_id) where is_primary = true;

create index if not exists item_categories_category_idx on catalog.item_categories (category_id);

-- Seed de planos iniciais
insert into catalog.listing_plans (listing_plan_id, plan_code, display_name, platform_fee_rate, psp_fee_rate, exposure_priority, queue_priority, benefits, is_active, valid_from)
values
  (gen_random_uuid(), 'BASIC', 'Básico', 0.0750, 0.0000, 0, 0, '{"exposure": "common", "queue_boost": false}'::jsonb, true, clock_timestamp()),
  (gen_random_uuid(), 'VIP', 'VIP', 0.1000, 0.0000, 10, 5, '{"exposure": "priority", "queue_boost": true}'::jsonb, true, clock_timestamp()),
  (gen_random_uuid(), 'PREMIUM', 'Premium', 0.1200, 0.0000, 20, 10, '{"exposure": "maximum", "queue_boost": true, "monthly_bonus": true, "badge_eligible": true}'::jsonb, true, clock_timestamp())
on conflict (plan_code) do nothing;