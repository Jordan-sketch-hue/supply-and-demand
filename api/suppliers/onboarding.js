const { json, readBody, methodNotAllowed, withApiGuard } = require('../_lib/http');
const { hasDatabase, sql } = require('../_lib/db');
const { requireUser, canAccessRole } = require('../_lib/auth');
const { validateCsrf } = require('../_lib/security/csrf');

module.exports = withApiGuard(async function handler(req, res) {
  if (req.method === 'POST') {
    if (!validateCsrf(req)) {
      json(res, 403, { error: 'CSRF validation failed' });
      return;
    }

    const user = await requireUser(req);
    if (!user || !canAccessRole(user.role, 'supplier')) {
      json(res, 403, { error: 'Supplier role required' });
      return;
    }

    if (!hasDatabase()) {
      json(res, 200, { ok: true, mode: 'mock' });
      return;
    }

    const body = await readBody(req);
    const businessName = String(body.businessName || '').trim();
    const phone = String(body.phone || '').trim() || null;
    const locationCity = String(body.locationCity || '').trim() || null;
    const serviceRadiusKm = Number(body.serviceRadiusKm || 0) || null;

    const upsert = await sql`
      insert into supplier_profiles (user_id, business_name, phone, location_city, service_radius_km, onboarding_status)
      values (${user.user_id}, ${businessName}, ${phone}, ${locationCity}, ${serviceRadiusKm}, 'pending_verification')
      on conflict (user_id)
      do update set
        business_name = excluded.business_name,
        phone = excluded.phone,
        location_city = excluded.location_city,
        service_radius_km = excluded.service_radius_km,
        onboarding_status = 'pending_verification',
        updated_at = now()
      returning id, onboarding_status;
    `;

    json(res, 200, { ok: true, profile: upsert.rows[0] });
    return;
  }

  if (req.method === 'GET') {
    const user = await requireUser(req);
    if (!user) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }

    if (!hasDatabase()) {
      json(res, 200, { profile: null });
      return;
    }

    const profile = await sql`
      select id, business_name, phone, location_city, service_radius_km, onboarding_status, created_at, updated_at
      from supplier_profiles
      where user_id = ${user.user_id}
      limit 1;
    `;

    json(res, 200, { profile: profile.rows[0] || null });
    return;
  }

  methodNotAllowed(res, ['GET', 'POST']);
}, { rateLimitKey: 'suppliers-onboarding', rateLimitMax: 80 });
