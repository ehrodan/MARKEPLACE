create schema if not exists merchandising;

-- ============================================================
-- Merchandising: relação entre itens, combo, perfil de gosto e
-- consciência de gasto. Tarefa 13 do SDD (parte de Recommendation).
--
-- Por que este módulo existe separado: recomendação e combo são LEITURA
-- DERIVADA sobre catálogo e pedido. Se morassem em catalog ou orders,
-- uma projeção de marketing viraria fonte de verdade comercial.
--
-- Fronteira de módulo: sem foreign key para orders, catalog ou identity.
-- A ordem de migration entre módulos não é garantida. Pedido, item e
-- usuário são referenciados por coluna de id simples.
--
-- Dinheiro: bigint em centavos, teto no inteiro seguro de JS porque o
-- TypeScript do módulo faz aritmética em BigInt mas serializa string.
-- ============================================================

-- ---------- Relação entre itens ----------
-- `weight_bp` em basis points inteiros: 10000 = 1,00. Nunca float —
-- peso de recomendação em float acumula erro e muda ordenação entre runs.
create table if not exists merchandising.item_relations (
  item_relation_id uuid primary key,
  source_catalog_item_id uuid not null,
  target_catalog_item_id uuid not null,
  kind text not null check (kind in (
    'COMPLEMENT','SAME_COLLECTION','SAME_CATEGORY','SAME_SELLER','PRICE_NEIGHBOR','CO_PURCHASED'
  )),
  weight_bp integer not null default 10000 check (weight_bp >= 0 and weight_bp <= 1000000),
  -- Quantas vezes o fato foi observado. CO_PURCHASED abaixo do K mínimo
  -- é ruído e pode reidentificar comportamento de uma pessoa.
  evidence_count integer not null default 0 check (evidence_count >= 0),
  source text not null default 'COMPUTED' check (source in ('COMPUTED','CURATED')),
  computed_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz,
  constraint item_relation_not_self check (source_catalog_item_id <> target_catalog_item_id),
  unique (source_catalog_item_id, target_catalog_item_id, kind)
);

create index if not exists item_relations_source_idx
  on merchandising.item_relations (source_catalog_item_id, kind, weight_bp desc);

-- ---------- Combo montado pelo usuário ----------
create table if not exists merchandising.bundles (
  bundle_id uuid primary key,
  owner_user_id uuid,
  name text,
  status text not null default 'DRAFT' check (status in ('DRAFT','SAVED','PURCHASED','ABANDONED')),
  currency char(3) check (currency ~ '^[A-Z]{3}$'),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create index if not exists bundles_owner_idx
  on merchandising.bundles (owner_user_id, status, updated_at desc);

-- `unit_price_minor` é o preço VIGENTE no momento em que o item entrou.
-- A economia do combo é sempre calculada contra a soma destes valores —
-- nunca contra um preço de referência arbitrário.
create table if not exists merchandising.bundle_items (
  bundle_item_id uuid primary key,
  bundle_id uuid not null references merchandising.bundles(bundle_id) on delete cascade,
  listing_id uuid not null,
  catalog_item_id uuid not null,
  quantity integer not null default 1 check (quantity > 0 and quantity <= 999),
  unit_price_minor bigint not null
    check (unit_price_minor >= 0 and unit_price_minor <= 9007199254740991),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  price_as_of timestamptz not null default clock_timestamp(),
  added_at timestamptz not null default clock_timestamp(),
  unique (bundle_id, listing_id)
);

-- ---------- Perfil de gosto ----------
-- A "espécie do usuário". Só existe COM consentimento registrado; sem
-- consentimento a linha não é criada, e não se infere às escondidas.
create table if not exists merchandising.taste_profiles (
  taste_profile_id uuid primary key,
  user_id uuid not null unique,
  primary_label text,
  secondary_label text,
  signals jsonb not null default '{}'::jsonb,
  -- confiança em basis points: abaixo do mínimo não rotula.
  confidence_bp integer not null default 0 check (confidence_bp >= 0 and confidence_bp <= 10000),
  source_event_count integer not null default 0 check (source_event_count >= 0),
  consent_granted boolean not null default false,
  consent_policy_version text,
  computed_at timestamptz not null default clock_timestamp(),
  -- Consentimento ausente e rótulo presente é estado proibido.
  constraint taste_profile_requires_consent
    check (consent_granted = true or (primary_label is null and secondary_label is null))
);

-- ---------- Consciência de gasto ----------
-- Não é controle parental nem bloqueio: é espelho. O teto é definido
-- pelo próprio usuário e o motor de recomendação o respeita.
create table if not exists merchandising.spend_windows (
  spend_window_id uuid primary key,
  user_id uuid not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  spent_minor bigint not null default 0
    check (spent_minor >= 0 and spent_minor <= 9007199254740991),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  order_count integer not null default 0 check (order_count >= 0),
  computed_at timestamptz not null default clock_timestamp(),
  constraint spend_window_ordered check (period_end > period_start),
  unique (user_id, period_start, currency)
);

create table if not exists merchandising.spend_limits (
  spend_limit_id uuid primary key,
  user_id uuid not null,
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  -- null = sem teto. O usuário pode remover o próprio limite.
  limit_minor bigint check (limit_minor >= 0 and limit_minor <= 9007199254740991),
  set_at timestamptz not null default clock_timestamp(),
  note text,
  unique (user_id, currency)
);
