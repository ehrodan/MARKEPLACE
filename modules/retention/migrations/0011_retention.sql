create schema if not exists retention;

-- =====================================================================================
-- FRONTEIRA DE MODULO (decisao deliberada, nao esquecimento)
--
-- O modulo `retention` NAO cria foreign key para tabelas de pedido/carrinho
-- (`modules/orders`, migration 0009) nem para `catalog.listings`.
-- Motivo: a ordem de aplicacao entre 0009, 0010 e 0011 nao esta garantida enquanto os
-- modulos sao construidos em paralelo, e uma FK cruzada quebraria a migracao se o alvo
-- ainda nao existisse. As colunas `source_cart_id`, `listing_id` e `catalog_item_id` sao,
-- por isso, identificadores simples (uuid) sem referencia declarada.
-- A integridade dessas colunas e responsabilidade da camada de aplicacao.
--
-- A UNICA FK mantida e para `identity.users` (migration 0003, ja aplicada antes desta).
-- =====================================================================================


-- -------------------------------------------------------------------------------------
-- saved_carts -- o carrinho SOBREVIVE. Atravessa sessao, dispositivo e login.
-- Persuasao legitima: a pessoa nunca perde o que escolheu.
-- -------------------------------------------------------------------------------------
create table if not exists retention.saved_carts (
  saved_cart_id uuid primary key,
  user_id uuid not null references identity.users(user_id),
  source_cart_id uuid not null,
  snapshot jsonb not null default '{}'::jsonb,
  item_count integer not null default 0 check (item_count >= 0),
  subtotal_minor bigint not null default 0 check (subtotal_minor >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  saved_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  recovered_at timestamptz,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','RECOVERED','EXPIRED')),
  version integer not null default 1 check (version > 0),
  constraint saved_carts_expiry_chk check (expires_at > saved_at),
  constraint saved_carts_recovered_chk check (
    (status = 'RECOVERED' and recovered_at is not null)
    or (status <> 'RECOVERED' and recovered_at is null)
  )
);

create index if not exists saved_carts_user_status_idx
  on retention.saved_carts (user_id, status, saved_at desc);
create index if not exists saved_carts_expiry_idx
  on retention.saved_carts (expires_at) where status = 'ACTIVE';
-- Um carrinho de origem tem no maximo um snapshot ativo; o historico permanece nas linhas
-- ja marcadas como RECOVERED ou EXPIRED.
create unique index if not exists saved_carts_active_source_uidx
  on retention.saved_carts (source_cart_id) where status = 'ACTIVE';


-- -------------------------------------------------------------------------------------
-- watchlist_entries -- vigilancia PEDIDA pela pessoa (queda de preco / volta ao estoque).
-- Nada aqui dispara sem que a pessoa tenha criado a entrada explicitamente.
-- `reference_price_minor` guarda o preco real observado no momento do pedido, para que o
-- aviso cite preco real e data real (nunca preco riscado que nunca foi praticado).
-- -------------------------------------------------------------------------------------
create table if not exists retention.watchlist_entries (
  watchlist_entry_id uuid primary key,
  user_id uuid not null references identity.users(user_id),
  listing_id uuid not null,
  catalog_item_id uuid not null,
  kind text not null check (kind in ('PRICE_DROP','BACK_IN_STOCK','ANY_OFFER')),
  target_price_minor bigint check (target_price_minor is null or target_price_minor >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  reference_price_minor bigint not null check (reference_price_minor >= 0),
  created_at timestamptz not null default clock_timestamp(),
  last_notified_at timestamptz,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','TRIGGERED','CANCELLED')),
  version integer not null default 1 check (version > 0),
  constraint watchlist_entries_user_listing_kind_uidx unique (user_id, listing_id, kind)
);

create index if not exists watchlist_entries_user_status_idx
  on retention.watchlist_entries (user_id, status, created_at desc);
create index if not exists watchlist_entries_listing_active_idx
  on retention.watchlist_entries (listing_id, kind) where status = 'ACTIVE';
create index if not exists watchlist_entries_item_idx
  on retention.watchlist_entries (catalog_item_id);


-- -------------------------------------------------------------------------------------
-- reminder_consents -- LIVRO-RAZAO append-only de consentimento.
-- Nenhuma linha e atualizada nem apagada: conceder e revogar sao sempre INSERT.
-- O estado corrente de (user_id, channel, purpose) e a linha mais recente por recorded_at.
-- Assim a revogacao fica registrada de forma irreversivel e auditavel.
--
-- `purpose = 'ORDER_UPDATE'` e TRANSACIONAL: nao exige consentimento de marketing.
-- Os demais purposes exigem consentimento explicito, nunca marcado por padrao.
-- `policy_version` e `evidence` registram sob qual texto e por qual caminho a pessoa optou.
-- -------------------------------------------------------------------------------------
create table if not exists retention.reminder_consents (
  reminder_consent_id uuid primary key,
  user_id uuid not null references identity.users(user_id),
  channel text not null check (channel in ('EMAIL','PUSH','IN_APP')),
  purpose text not null check (purpose in ('CART_RECOVERY','PRICE_WATCH','STOCK_WATCH','ORDER_UPDATE')),
  granted boolean not null,
  granted_at timestamptz,
  revoked_at timestamptz,
  policy_version text not null,
  evidence jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default clock_timestamp(),
  constraint reminder_consents_state_chk check (
    (granted = true and granted_at is not null and revoked_at is null)
    or (granted = false and revoked_at is not null and granted_at is null)
  )
);

create index if not exists reminder_consents_current_idx
  on retention.reminder_consents (user_id, purpose, channel, recorded_at desc);
create index if not exists reminder_consents_user_idx
  on retention.reminder_consents (user_id, recorded_at desc);


-- -------------------------------------------------------------------------------------
-- reminder_dispatches -- toda tentativa de lembrete, enviada OU suprimida.
-- Uma tentativa recusada tambem grava linha, com `suppressed_reason` nomeado. O historico
-- de recusa e o que prova, em auditoria, que a politica foi aplicada e nao contornada.
--
-- DEDUPE: o indice unico e PARCIAL, so sobre linhas nao suprimidas. Assim o mesmo motivo
-- nunca dispara duas vezes, mas uma tentativa SUPRIMIDA nao queima o dedupe_key para
-- sempre -- o registro de supressao continua append-only.
-- -------------------------------------------------------------------------------------
create table if not exists retention.reminder_dispatches (
  reminder_dispatch_id uuid primary key,
  user_id uuid not null references identity.users(user_id),
  purpose text not null check (purpose in ('CART_RECOVERY','PRICE_WATCH','STOCK_WATCH','ORDER_UPDATE')),
  channel text not null check (channel in ('EMAIL','PUSH','IN_APP')),
  subject_ref text,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  suppressed_reason text,
  dedupe_key text not null check (length(dedupe_key) between 1 and 200),
  created_at timestamptz not null default clock_timestamp(),
  constraint reminder_dispatches_terminal_chk check (sent_at is null or suppressed_reason is null)
);

create unique index if not exists reminder_dispatches_dedupe_key_uidx
  on retention.reminder_dispatches (dedupe_key) where suppressed_reason is null;
create index if not exists reminder_dispatches_user_created_idx
  on retention.reminder_dispatches (user_id, created_at desc);
create index if not exists reminder_dispatches_pending_idx
  on retention.reminder_dispatches (scheduled_for)
  where sent_at is null and suppressed_reason is null;
create index if not exists reminder_dispatches_user_purpose_sent_idx
  on retention.reminder_dispatches (user_id, purpose, sent_at desc)
  where suppressed_reason is null;
create index if not exists reminder_dispatches_subject_idx
  on retention.reminder_dispatches (subject_ref, purpose) where suppressed_reason is null;


-- -------------------------------------------------------------------------------------
-- notifications -- feed in-app. Canal PULL: a propria pessoa consulta.
-- Por ser consultado e nao empurrado, nao exige consentimento de marketing; ainda assim
-- uma revogacao explicita registrada em reminder_consents bloqueia o envio (ver
-- src/reminder-policy.ts).
-- -------------------------------------------------------------------------------------
create table if not exists retention.notifications (
  notification_id uuid primary key,
  user_id uuid not null references identity.users(user_id),
  kind text not null check (kind in (
    'CART_SAVED','CART_REMINDER','PRICE_DROP','BACK_IN_STOCK','ORDER_UPDATE','CONSENT_UPDATED'
  )),
  title text not null check (length(title) between 1 and 160),
  body text not null check (length(body) between 1 and 1000),
  deep_link text,
  related_ref text,
  read_at timestamptz,
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists notifications_user_created_idx
  on retention.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on retention.notifications (user_id, created_at desc) where read_at is null;
create index if not exists notifications_kind_idx
  on retention.notifications (kind, created_at desc);
