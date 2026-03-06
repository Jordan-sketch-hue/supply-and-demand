-- Supply & Demand - PostgreSQL relational starter schema

create extension if not exists pgcrypto;

create table locations (
  id uuid primary key default gen_random_uuid(),
  country text not null,
  region text,
  city text not null,
  neighborhood text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text,
  full_name text not null,
  phone text,
  role text not null check (role in ('consumer', 'supplier', 'admin')),
  oauth_provider text,
  oauth_subject text,
  location_id uuid references locations(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references users(id),
  business_name text,
  service_radius_km integer,
  bio text,
  onboarding_status text not null default 'draft' check (
    onboarding_status in ('draft', 'pending_verification', 'verified', 'restricted', 'active')
  ),
  trust_score numeric(5,2) not null default 0,
  verified_badge boolean not null default false,
  commission_rate numeric(5,2) not null default 10.00,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  parent_id uuid references categories(id),
  color_hex text,
  created_at timestamptz not null default now()
);

create table services (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id),
  category_id uuid not null references categories(id),
  title text not null,
  description text,
  pricing_model text not null check (pricing_model in ('fixed', 'hourly', 'quote')),
  base_price numeric(12,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id),
  category_id uuid not null references categories(id),
  name text not null,
  description text,
  sku text,
  price numeric(12,2) not null,
  inventory_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table demand_requests (
  id uuid primary key default gen_random_uuid(),
  consumer_id uuid not null references users(id),
  raw_query text not null,
  parsed_intent text,
  parsed_category_id uuid references categories(id),
  urgency text not null default 'standard' check (urgency in ('standard', 'today', 'urgent')),
  budget_min numeric(12,2),
  budget_max numeric(12,2),
  location_id uuid references locations(id),
  status text not null default 'open' check (status in ('open', 'matched', 'booked', 'closed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  demand_request_id uuid not null references demand_requests(id),
  supplier_id uuid not null references suppliers(id),
  score numeric(8,4) not null,
  reason jsonb,
  created_at timestamptz not null default now(),
  unique(demand_request_id, supplier_id)
);

create table quotes (
  id uuid primary key default gen_random_uuid(),
  demand_request_id uuid not null references demand_requests(id),
  supplier_id uuid not null references suppliers(id),
  amount numeric(12,2) not null,
  currency text not null default 'USD',
  message text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired')),
  created_at timestamptz not null default now()
);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  demand_request_id uuid not null references demand_requests(id),
  supplier_id uuid not null references suppliers(id),
  consumer_id uuid not null references users(id),
  scheduled_at timestamptz,
  status text not null default 'pending' check (
    status in ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'disputed')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id),
  payer_user_id uuid not null references users(id),
  payee_supplier_id uuid not null references suppliers(id),
  gross_amount numeric(12,2) not null,
  commission_amount numeric(12,2) not null,
  currency text not null default 'USD',
  stripe_payment_intent_id text,
  status text not null check (status in ('initiated', 'held', 'released', 'refunded', 'failed')),
  created_at timestamptz not null default now()
);

create table escrow_payments (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null unique references transactions(id),
  hold_status text not null check (hold_status in ('held', 'partially_released', 'released', 'refunded')),
  held_at timestamptz not null default now(),
  released_at timestamptz,
  released_amount numeric(12,2)
);

create table disputes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id),
  raised_by_user_id uuid not null references users(id),
  issue text not null,
  status text not null default 'open' check (status in ('open', 'investigating', 'resolved', 'rejected')),
  resolution text,
  resolved_by_user_id uuid references users(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table dispute_evidence (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references disputes(id),
  uploader_user_id uuid not null references users(id),
  file_url text,
  description text,
  created_at timestamptz not null default now()
);

create table job_completions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references bookings(id),
  consumer_confirmed boolean not null default false,
  supplier_confirmed boolean not null default false,
  proof_url text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id),
  reviewer_user_id uuid not null references users(id),
  supplier_id uuid not null references suppliers(id),
  rating integer not null check (rating between 1 and 5),
  review_text text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  unique(booking_id, reviewer_user_id)
);

create table message_threads (
  id uuid primary key default gen_random_uuid(),
  consumer_id uuid not null references users(id),
  supplier_id uuid not null references suppliers(id),
  demand_request_id uuid references demand_requests(id),
  created_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references message_threads(id),
  sender_user_id uuid not null references users(id),
  message_text text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index idx_supplier_location on users(location_id);
create index idx_services_category on services(category_id);
create index idx_products_category on products(category_id);
create index idx_demands_status on demand_requests(status);
create index idx_bookings_status on bookings(status);
create index idx_transactions_status on transactions(status);
