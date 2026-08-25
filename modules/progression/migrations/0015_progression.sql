create schema if not exists progression;

-- ============================================================
-- Progressão: nível, contribuição, insígnia, recompensa e temporada de ranking.
-- Tarefa 24 do SDD.
--
-- Motivo desta migration existir: modules/progression/src já tinha as REGRAS
-- (level-policy, leaderboard-policy, contribution-replay) mas nenhuma tabela.
-- `createAccountLevelPolicyVersion` é uma FÁBRICA que valida limiares recebidos
-- de fora — e não havia "fora". Nível e ranking não persistiam.
--
-- Fronteira de módulo: sem foreign key para orders, finance ou promotions. A
-- ordem de migration entre módulos não é garantida, então pedido, pagamento e
-- comissão são referenciados por (source_kind, source_ref) textual. FK apenas
-- para identity (0003) e sellers (0005), que sempre rodam antes.
--
-- Dinheiro: bigint em centavos. O TypeScript do módulo usa `number` guardado
-- por `assertMinorBrl` (Number.isSafeInteger), então os valores precisam ficar
-- abaixo de 2^53 centavos. O check abaixo trava isso no banco também.
-- ============================================================

-- ---------- Política de nível, versionada ----------
-- A definição é dado, não código. Publicar uma nova versão nunca reescreve a
-- anterior: atribuição histórica continua apontando para a versão que valia.
create table if not exists progression.account_level_policy_versions (
  policy_version text primary key check (length(trim(policy_version)) > 0),
  currency char(3) not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'DRAFT' check (status in ('DRAFT','PUBLISHED','SUPERSEDED')),
  published_at timestamptz,
  superseded_at timestamptz,
  notes text,
  created_at timestamptz not null default clock_timestamp()
);

-- Somente uma versão publicada por moeda ao mesmo tempo.
create unique index if not exists account_level_policy_published_uidx
  on progression.account_level_policy_versions (currency) where status = 'PUBLISHED';

-- ---------- Faixas de nível L1..L10 ----------
-- O formato espelha AccountLevelDefinition de level-policy.ts: min inclusivo,
-- max inclusivo, e somente L10 pode ter max nulo (sem teto).
create table if not exists progression.account_level_definitions (
  policy_version text not null references progression.account_level_policy_versions(policy_version) on delete cascade,
  level text not null check (level in ('L1','L2','L3','L4','L5','L6','L7','L8','L9','L10')),
  min_inclusive_minor bigint not null check (min_inclusive_minor >= 0 and min_inclusive_minor <= 9007199254740991),
  max_inclusive_minor bigint check (max_inclusive_minor >= 0 and max_inclusive_minor <= 9007199254740991),
  benefits jsonb not null default '{}'::jsonb,
  primary key (policy_version, level),
  -- Intervalo nunca invertido.
  constraint account_level_range_ordered
    check (max_inclusive_minor is null or max_inclusive_minor >= min_inclusive_minor),
  -- Só L10 fica sem teto; e L10 nunca tem teto. Espelha a regra da policy.
  constraint account_level_open_ended_only_l10
    check ((level = 'L10' and max_inclusive_minor is null)
        or (level <> 'L10' and max_inclusive_minor is not null))
);

-- ---------- Atribuição de nível vigente ----------
-- `subject_kind` separa reputação de comprador e de vendedor: o doc 07 exige
-- que as duas NUNCA sejam somadas.
create table if not exists progression.account_level_assignments (
  assignment_id uuid primary key,
  subject_kind text not null check (subject_kind in ('USER','SELLER_ACCOUNT')),
  subject_ref uuid not null,
  policy_version text not null references progression.account_level_policy_versions(policy_version),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  level text not null check (level in ('L1','L2','L3','L4','L5','L6','L7','L8','L9','L10')),
  qualified_lifetime_gmv_minor bigint not null default 0
    check (qualified_lifetime_gmv_minor >= 0 and qualified_lifetime_gmv_minor <= 9007199254740991),
  assigned_at timestamptz not null default clock_timestamp(),
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default clock_timestamp(),
  unique (subject_kind, subject_ref, currency)
);

create index if not exists account_level_assignments_level_idx
  on progression.account_level_assignments (currency, level);

-- ---------- Contribuições ----------
-- Ledger append-only. Refund e chargeback NUNCA apagam nem editam a
-- contribuição original: criam uma COMPENSATÓRIA apontando para ela. Sem isso
-- o nível só sobe e o sistema mente para o usuário.
create table if not exists progression.progression_contributions (
  contribution_id uuid primary key,
  subject_kind text not null check (subject_kind in ('USER','SELLER_ACCOUNT')),
  subject_ref uuid not null,
  source_kind text not null check (source_kind in ('ORDER','REFUND','CHARGEBACK','ADJUSTMENT')),
  -- Referência textual, sem FK: orders/finance podem migrar depois deste módulo.
  source_ref text not null,
  amount_minor bigint not null check (amount_minor >= -9007199254740991 and amount_minor <= 9007199254740991),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  weight_bp integer not null default 10000 check (weight_bp >= 0),
  compensates_contribution_id uuid references progression.progression_contributions(contribution_id),
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default clock_timestamp(),
  -- Idempotência de replay: o mesmo fato da mesma fonte não entra duas vezes.
  unique (subject_kind, subject_ref, source_kind, source_ref)
);

-- Compensação é sempre negativa; contribuição normal é sempre positiva ou zero.
alter table progression.progression_contributions
  drop constraint if exists progression_contribution_sign;
alter table progression.progression_contributions
  add constraint progression_contribution_sign check (
    (compensates_contribution_id is null and amount_minor >= 0)
    or (compensates_contribution_id is not null and amount_minor <= 0)
  );

create index if not exists progression_contributions_subject_idx
  on progression.progression_contributions (subject_kind, subject_ref, occurred_at desc);

-- ---------- Insígnias ----------
create table if not exists progression.badge_definitions (
  badge_code text primary key check (length(trim(badge_code)) > 0),
  display_name text not null,
  description text not null,
  criteria jsonb not null default '{}'::jsonb,
  policy_version text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT','PUBLISHED','RETIRED')),
  created_at timestamptz not null default clock_timestamp()
);

create table if not exists progression.badge_awards (
  badge_award_id uuid primary key,
  badge_code text not null references progression.badge_definitions(badge_code),
  subject_kind text not null check (subject_kind in ('USER','SELLER_ACCOUNT')),
  subject_ref uuid not null,
  awarded_at timestamptz not null default clock_timestamp(),
  revoked_at timestamptz,
  revoke_reason text,
  evidence jsonb not null default '{}'::jsonb,
  unique (badge_code, subject_kind, subject_ref)
);

-- ---------- Recompensas ----------
-- `fulfillment_status` existe porque conceder não é entregar. A tela precisa
-- distinguir "prêmio concedido" de "prêmio entregue" — confundir os dois gera
-- reclamação, do mesmo jeito que aprovar reembolso não é devolver dinheiro.
create table if not exists progression.reward_definitions (
  reward_code text primary key check (length(trim(reward_code)) > 0),
  display_name text not null,
  description text not null,
  reward_kind text not null check (reward_kind in ('FEE_DISCOUNT','EXPOSURE_BOOST','BADGE','EXTERNAL_ITEM','UNDEFINED')),
  terms jsonb not null default '{}'::jsonb,
  policy_version text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT','PUBLISHED','RETIRED')),
  created_at timestamptz not null default clock_timestamp()
);

create table if not exists progression.reward_awards (
  reward_award_id uuid primary key,
  reward_code text not null references progression.reward_definitions(reward_code),
  subject_kind text not null check (subject_kind in ('USER','SELLER_ACCOUNT')),
  subject_ref uuid not null,
  awarded_at timestamptz not null default clock_timestamp(),
  fulfillment_status text not null default 'PENDING'
    check (fulfillment_status in ('PENDING','FULFILLED','FAILED','CANCELLED')),
  fulfilled_at timestamptz,
  failure_reason text,
  evidence jsonb not null default '{}'::jsonb
);

create index if not exists reward_awards_subject_idx
  on progression.reward_awards (subject_kind, subject_ref, awarded_at desc);

-- ---------- Temporadas de ranking ----------
create table if not exists progression.leaderboard_seasons (
  season_id uuid primary key,
  season_code text not null unique check (length(trim(season_code)) > 0),
  formula_version text not null check (length(trim(formula_version)) > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'SCHEDULED'
    check (status in ('SCHEDULED','OPEN','CLOSED','SETTLED')),
  created_at timestamptz not null default clock_timestamp(),
  constraint leaderboard_season_window check (ends_at > starts_at)
);

-- `position` é nullable de propósito: empate real permanece empate e a
-- projeção não inventa ordem para desempatar o que a fórmula não desempata.
create table if not exists progression.leaderboard_entries (
  season_id uuid not null references progression.leaderboard_seasons(season_id) on delete cascade,
  subject_kind text not null check (subject_kind in ('USER','SELLER_ACCOUNT')),
  subject_ref uuid not null,
  points bigint not null default 0 check (points >= 0),
  eligible_gmv_minor bigint not null default 0
    check (eligible_gmv_minor >= 0 and eligible_gmv_minor <= 9007199254740991),
  position integer check (position is null or position > 0),
  computed_at timestamptz not null default clock_timestamp(),
  primary key (season_id, subject_kind, subject_ref)
);

create index if not exists leaderboard_entries_rank_idx
  on progression.leaderboard_entries (season_id, points desc, eligible_gmv_minor desc);

create table if not exists progression.leaderboard_awards (
  leaderboard_award_id uuid primary key,
  season_id uuid not null references progression.leaderboard_seasons(season_id),
  subject_kind text not null check (subject_kind in ('USER','SELLER_ACCOUNT')),
  subject_ref uuid not null,
  position integer not null check (position > 0),
  award_description text not null,
  fulfillment_status text not null default 'PENDING'
    check (fulfillment_status in ('PENDING','FULFILLED','FAILED','CANCELLED')),
  awarded_at timestamptz not null default clock_timestamp(),
  evidence jsonb not null default '{}'::jsonb,
  unique (season_id, subject_kind, subject_ref)
);

-- ============================================================
-- Seed da política de nível v1 — valores LITERAIS de RF-237 do PRD
-- (docs/01-PRD-MIDAS.md). Limite inferior EXCLUSIVO e superior
-- INCLUSIVO, exceto L10 sem teto — exatamente como o PRD escreve.
--
-- Nenhum número aqui foi inventado. Conversão para centavos de BRL:
--   L1  R$0–100          ->        0 ..    10000
--   L2  >R$100–500       ->    10001 ..    50000
--   L3  >R$500–1.000     ->    50001 ..   100000
--   L4  >R$1.000–3.000   ->   100001 ..   300000
--   L5  >R$3.000–5.000   ->   300001 ..   500000
--   L6  >R$5.000–7.500   ->   500001 ..   750000
--   L7  >R$7.500–10.000  ->   750001 ..  1000000
--   L8  >R$10.000–20.000 ->  1000001 ..  2000000
--   L9  >R$20.000–50.000 ->  2000001 ..  5000000
--   L10 >R$50.000        ->  5000001 ..  (sem teto)
--
-- O formato satisfaz a invariante de createAccountLevelPolicyVersion em
-- modules/progression/src/level-policy.ts: cada faixa começa exatamente em
-- (max da anterior + 1), L1 começa em zero e só L10 fica sem limite superior.
-- ============================================================

insert into progression.account_level_policy_versions
  (policy_version, currency, status, published_at, notes)
values
  ('seller-level-v1', 'BRL', 'PUBLISHED', clock_timestamp(),
   'Faixas literais de RF-237 do PRD 3.1. Base: volume vitalicio elegivel normalizado em BRL.')
on conflict (policy_version) do nothing;

insert into progression.account_level_definitions
  (policy_version, level, min_inclusive_minor, max_inclusive_minor)
values
  ('seller-level-v1', 'L1',        0,   10000),
  ('seller-level-v1', 'L2',    10001,   50000),
  ('seller-level-v1', 'L3',    50001,  100000),
  ('seller-level-v1', 'L4',   100001,  300000),
  ('seller-level-v1', 'L5',   300001,  500000),
  ('seller-level-v1', 'L6',   500001,  750000),
  ('seller-level-v1', 'L7',   750001, 1000000),
  ('seller-level-v1', 'L8',  1000001, 2000000),
  ('seller-level-v1', 'L9',  2000001, 5000000),
  ('seller-level-v1', 'L10', 5000001,    null)
on conflict (policy_version, level) do nothing;
