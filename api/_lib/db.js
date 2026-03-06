const { sql } = require('@vercel/postgres');
const crypto = require('crypto');

function hasDatabase() {
  return Boolean(process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL);
}

async function runBootstrap() {
  await sql`create extension if not exists pgcrypto;`;

  await sql`
    create table if not exists auth_users (
      id uuid primary key default gen_random_uuid(),
      email text unique not null,
      full_name text not null,
      password_hash text not null,
      role text not null check (role in ('consumer', 'supplier', 'admin')),
      created_at timestamptz not null default now()
    );
  `;

  await sql`
    create table if not exists auth_sessions (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth_users(id) on delete cascade,
      token_hash text unique not null,
      expires_at timestamptz not null,
      created_at timestamptz not null default now()
    );
  `;

  await sql`
    create table if not exists suppliers (
      id uuid primary key default gen_random_uuid(),
      business_name text not null,
      service_title text not null,
      city text not null,
      trust_score numeric(4,2) not null default 4.50,
      distance_km numeric(6,2) not null default 1.00,
      available_minutes integer not null default 60,
      verified_badge boolean not null default true,
      created_at timestamptz not null default now()
    );
  `;

  await sql`
    create table if not exists supplier_profiles (
      id uuid primary key default gen_random_uuid(),
      user_id uuid unique references auth_users(id) on delete cascade,
      business_name text,
      phone text,
      location_city text,
      service_radius_km integer,
      onboarding_status text not null default 'draft' check (
        onboarding_status in ('draft', 'pending_verification', 'verified', 'active', 'rejected')
      ),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `;

  await sql`
    create table if not exists verification_documents (
      id uuid primary key default gen_random_uuid(),
      supplier_profile_id uuid not null references supplier_profiles(id) on delete cascade,
      doc_type text not null,
      file_url text,
      review_status text not null default 'pending' check (
        review_status in ('pending', 'approved', 'rejected')
      ),
      reviewer_notes text,
      created_at timestamptz not null default now()
    );
  `;

  await sql`
    create table if not exists adverts (
      id uuid primary key default gen_random_uuid(),
      company_name text not null,
      contact_name text,
      contact_email text not null,
      contact_phone text,
      ad_category text not null,
      target_city text,
      budget_usd numeric(12,2),
      source_channel text,
      objective text,
      creative_summary text,
      placement text not null default 'homepage_hero',
      status text not null default 'pending' check (
        status in ('pending', 'approved', 'rejected', 'live', 'paused')
      ),
      created_at timestamptz not null default now()
    );
  `;

  await sql`
    create table if not exists demand_requests (
      id uuid primary key default gen_random_uuid(),
      raw_query text not null,
      category text not null,
      urgency text not null,
      country text,
      city text,
      neighborhood text,
      details text,
      created_at timestamptz not null default now()
    );
  `;

  await sql`
    create table if not exists bookings (
      id uuid primary key default gen_random_uuid(),
      consumer_user_id uuid references auth_users(id),
      supplier_user_id uuid references auth_users(id),
      demand_request_id uuid references demand_requests(id),
      status text not null default 'pending' check (
        status in ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'disputed')
      ),
      scheduled_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `;

  await sql`
    create table if not exists message_threads (
      id uuid primary key default gen_random_uuid(),
      booking_id uuid references bookings(id),
      consumer_user_id uuid references auth_users(id),
      supplier_user_id uuid references auth_users(id),
      created_at timestamptz not null default now()
    );
  `;

  await sql`
    create table if not exists messages (
      id uuid primary key default gen_random_uuid(),
      thread_id uuid not null references message_threads(id) on delete cascade,
      sender_user_id uuid references auth_users(id),
      body text not null,
      created_at timestamptz not null default now()
    );
  `;

  await sql`
    create table if not exists escrow_transactions (
      id uuid primary key default gen_random_uuid(),
      booking_id uuid references bookings(id),
      stripe_payment_intent_id text,
      amount numeric(12,2),
      currency text default 'usd',
      status text not null default 'held' check (
        status in ('held', 'released', 'refunded', 'failed')
      ),
      created_at timestamptz not null default now()
    );
  `;

  await sql`
    create table if not exists webhook_events (
      id uuid primary key default gen_random_uuid(),
      provider text not null,
      event_id text not null,
      event_type text not null,
      payload jsonb,
      processed boolean not null default false,
      created_at timestamptz not null default now(),
      unique(provider, event_id)
    );
  `;

  await sql`
    create table if not exists trust_cases (
      id uuid primary key default gen_random_uuid(),
      case_type text not null check (case_type in ('dispute', 'fraud', 'verification')),
      severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
      status text not null default 'open' check (status in ('open', 'investigating', 'resolved')),
      reference_id text,
      summary text,
      created_at timestamptz not null default now()
    );
  `;

  await sql`
    create table if not exists admin_audit_logs (
      id uuid primary key default gen_random_uuid(),
      actor_user_id uuid references auth_users(id),
      actor_email text,
      action text not null,
      entity_type text not null,
      entity_id text,
      details jsonb,
      created_at timestamptz not null default now()
    );
  `;

  await sql`
    create table if not exists saved_searches (
      id uuid primary key default gen_random_uuid(),
      query_text text not null,
      city text,
      demand_count integer not null default 1,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `;

  const existing = await sql`select count(*)::int as count from suppliers;`;
  if (existing.rows[0].count === 0) {
    await sql`
      insert into suppliers (business_name, service_title, city, trust_score, distance_km, available_minutes, verified_badge)
      values
        ('Kingston PipeCare Pro', 'Plumbing and leak repair', 'Kingston', 4.90, 2.10, 35, true),
        ('RapidFix Mechanics', 'Auto diagnostics and roadside support', 'Montego Bay', 4.80, 3.70, 25, true),
        ('Prime Build Electrical', 'Residential electrical and panel upgrades', 'Kingston', 4.70, 4.30, 55, true),
        ('CleanWave Teams', 'Deep cleaning and move-out services', 'Miami', 4.85, 2.80, 45, true),
        ('Metro Creative Studio', 'Graphic design and brand assets', 'Miami', 4.75, 5.20, 120, false);
    `;
  }

  const adminExists = await sql`select count(*)::int as count from auth_users where role = 'admin';`;
  if (adminExists.rows[0].count === 0) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync('Admin123!ChangeMe', salt, 100_000, 32, 'sha256').toString('hex');
    await sql`
      insert into auth_users (email, full_name, password_hash, role)
      values ('admin@supplyanddemand.com', 'Platform Admin', ${`${salt}:${hash}`}, 'admin');
    `;
  }

  const trustCount = await sql`select count(*)::int as count from trust_cases;`;
  if (trustCount.rows[0].count === 0) {
    await sql`
      insert into trust_cases (case_type, severity, status, reference_id, summary)
      values
        ('verification', 'medium', 'open', 'supplier-profile:seed-1', 'Missing insurance expiry date proof.'),
        ('fraud', 'high', 'investigating', 'booking:seed-2', 'Potential duplicate account and review manipulation.'),
        ('dispute', 'medium', 'open', 'booking:seed-3', 'Customer claims incomplete delivery.');
    `;
  }
}

async function writeAdminAuditLog({
  actorUserId,
  actorEmail,
  action,
  entityType,
  entityId,
  details
}) {
  await sql`
    insert into admin_audit_logs (actor_user_id, actor_email, action, entity_type, entity_id, details)
    values (
      ${actorUserId || null},
      ${actorEmail || null},
      ${action},
      ${entityType},
      ${entityId || null},
      ${details ? JSON.stringify(details) : null}
    );
  `;
}

module.exports = {
  sql,
  hasDatabase,
  runBootstrap,
  writeAdminAuditLog
};
