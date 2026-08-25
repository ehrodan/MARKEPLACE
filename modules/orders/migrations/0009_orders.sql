create schema if not exists orders;

-- Carrinho persistido do usuário autenticado (visitante usa localStorage e faz merge no login)
create table if not exists orders.carts (
  cart_id uuid primary key,
  user_id uuid not null references identity.users(user_id),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','CONVERTED','ABANDONED')),
  currency char(3) check (currency ~ '^[A-Z]{3}$'),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create unique index if not exists carts_active_per_user_uidx
  on orders.carts (user_id) where status = 'ACTIVE';

create index if not exists carts_user_idx on orders.carts (user_id);

-- Linhas do carrinho: preço revalidado contra o anúncio no momento da inclusão
create table if not exists orders.cart_lines (
  cart_line_id uuid primary key,
  cart_id uuid not null references orders.carts(cart_id) on delete cascade,
  listing_id uuid not null references catalog.listings(listing_id),
  seller_account_id uuid not null references sellers.seller_accounts(seller_account_id),
  quantity integer not null check (quantity > 0),
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  added_at timestamptz not null default clock_timestamp(),
  price_as_of timestamptz not null default clock_timestamp(),
  constraint cart_lines_listing_uidx unique (cart_id, listing_id)
);

create index if not exists cart_lines_cart_idx on orders.cart_lines (cart_id);
create index if not exists cart_lines_listing_idx on orders.cart_lines (listing_id);
create index if not exists cart_lines_seller_idx on orders.cart_lines (cart_id, seller_account_id);

-- Pedido: um pedido por vendedor (o carrinho é agrupado por seller_account_id no checkout)
create table if not exists orders.orders (
  order_id uuid primary key,
  public_code text not null unique,
  buyer_user_id uuid not null references identity.users(user_id),
  seller_account_id uuid not null references sellers.seller_accounts(seller_account_id),
  status text not null default 'PENDING_PAYMENT'
    check (status in ('PENDING_PAYMENT','PAID','IN_DELIVERY','COMPLETED','CANCELLED','DISPUTED','REFUNDED')),
  subtotal_minor bigint not null check (subtotal_minor >= 0),
  fee_minor bigint not null check (fee_minor >= 0),
  total_minor bigint not null check (total_minor >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  idempotency_key text not null unique,
  reserved_until timestamptz,
  placed_at timestamptz not null default clock_timestamp(),
  paid_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint orders_fee_within_subtotal_chk check (fee_minor <= subtotal_minor),
  constraint orders_paid_status_chk check (paid_at is null or status <> 'PENDING_PAYMENT'),
  constraint orders_completed_status_chk check (completed_at is null or status in ('COMPLETED','REFUNDED')),
  constraint orders_cancelled_status_chk check (cancelled_at is null or status = 'CANCELLED')
);

create index if not exists orders_buyer_idx
  on orders.orders (buyer_user_id, created_at desc, order_id desc);
create index if not exists orders_seller_idx
  on orders.orders (seller_account_id, created_at desc, order_id desc);
create index if not exists orders_status_idx on orders.orders (status);
create index if not exists orders_reservation_idx
  on orders.orders (reserved_until) where status = 'PENDING_PAYMENT';

-- Itens do pedido com snapshot imutável do anúncio no instante da compra
create table if not exists orders.order_items (
  order_item_id uuid primary key,
  order_id uuid not null references orders.orders(order_id) on delete cascade,
  listing_id uuid not null references catalog.listings(listing_id),
  catalog_item_id uuid not null references catalog.catalog_items(catalog_item_id),
  quantity integer not null check (quantity > 0),
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  total_minor bigint not null check (total_minor >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  listing_snapshot jsonb not null default '{}'::jsonb
);

create index if not exists order_items_order_idx on orders.order_items (order_id);
create index if not exists order_items_listing_idx on orders.order_items (listing_id);

-- Linha do tempo do pedido (timeline exibida no detalhe da compra)
create table if not exists orders.order_events (
  order_event_id uuid primary key,
  order_id uuid not null references orders.orders(order_id) on delete cascade,
  event_type text not null,
  from_status text
    check (from_status is null or from_status in ('PENDING_PAYMENT','PAID','IN_DELIVERY','COMPLETED','CANCELLED','DISPUTED','REFUNDED')),
  to_status text
    check (to_status is null or to_status in ('PENDING_PAYMENT','PAID','IN_DELIVERY','COMPLETED','CANCELLED','DISPUTED','REFUNDED')),
  actor_user_id uuid references identity.users(user_id),
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default clock_timestamp()
);

create index if not exists order_events_order_idx on orders.order_events (order_id, occurred_at, order_event_id);

-- Entrega com dupla confirmação (comprador e vendedor)
create table if not exists orders.deliveries (
  delivery_id uuid primary key,
  order_id uuid not null unique references orders.orders(order_id) on delete cascade,
  status text not null default 'PENDING'
    check (status in ('PENDING','BUYER_CONFIRMED','SELLER_CONFIRMED','BOTH_CONFIRMED')),
  buyer_confirmed_at timestamptz,
  seller_confirmed_at timestamptz,
  instruction_revealed_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint deliveries_buyer_confirmation_chk
    check ((buyer_confirmed_at is null) = (status not in ('BUYER_CONFIRMED','BOTH_CONFIRMED'))),
  constraint deliveries_seller_confirmation_chk
    check ((seller_confirmed_at is null) = (status not in ('SELLER_CONFIRMED','BOTH_CONFIRMED')))
);

create index if not exists deliveries_status_idx on orders.deliveries (status);
