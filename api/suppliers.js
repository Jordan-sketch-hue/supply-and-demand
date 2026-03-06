const { json, readBody, methodNotAllowed, withApiGuard } = require('../server/lib/http');
const { hasDatabase, sql } = require('../server/lib/db');
const { requireUser, canAccessRole } = require('../server/lib/auth');
const { validateCsrf } = require('../server/lib/csrf');

module.exports = withApiGuard(async function handler(req, res) {
  const op = String(req.query.op || '').trim();

  if (op === 'onboarding') {
    if (req.method === 'GET') {
      const user = await requireUser(req);
      if (!user) return json(res, 401, { error: 'Unauthorized' });
      if (!hasDatabase()) return json(res, 200, { profile: null });
      const profile = await sql`select id, business_name, phone, location_city, service_radius_km, onboarding_status, created_at, updated_at from supplier_profiles where user_id = ${user.user_id} limit 1;`;
      return json(res, 200, { profile: profile.rows[0] || null });
    }

    if (req.method === 'POST') {
      if (!validateCsrf(req)) return json(res, 403, { error: 'CSRF validation failed' });
      const user = await requireUser(req);
      if (!user || !canAccessRole(user.role, 'supplier')) return json(res, 403, { error: 'Supplier role required' });
      if (!hasDatabase()) return json(res, 200, { ok: true, mode: 'mock' });
      const body = await readBody(req);
      const upsert = await sql`
        insert into supplier_profiles (user_id, business_name, phone, location_city, service_radius_km, onboarding_status)
        values (${user.user_id}, ${String(body.businessName || '').trim()}, ${String(body.phone || '').trim() || null}, ${String(body.locationCity || '').trim() || null}, ${Number(body.serviceRadiusKm || 0) || null}, 'pending_verification')
        on conflict (user_id)
        do update set business_name = excluded.business_name, phone = excluded.phone, location_city = excluded.location_city, service_radius_km = excluded.service_radius_km, onboarding_status = 'pending_verification', updated_at = now()
        returning id, onboarding_status;
      `;
      return json(res, 200, { ok: true, profile: upsert.rows[0] });
    }

    return methodNotAllowed(res, ['GET', 'POST']);
  }

  if (op === 'documents') {
    if (req.method === 'GET') {
      const user = await requireUser(req);
      if (!user) return json(res, 401, { error: 'Unauthorized' });
      if (!hasDatabase()) return json(res, 200, { documents: [] });
      const profile = await sql`select id from supplier_profiles where user_id = ${user.user_id} limit 1;`;
      if (profile.rows.length === 0) return json(res, 200, { documents: [] });
      const docs = await sql`select id, doc_type, file_url, review_status, reviewer_notes, created_at from verification_documents where supplier_profile_id = ${profile.rows[0].id} order by created_at desc;`;
      return json(res, 200, { documents: docs.rows });
    }

    if (req.method === 'POST') {
      if (!validateCsrf(req)) return json(res, 403, { error: 'CSRF validation failed' });
      const user = await requireUser(req);
      if (!user || !canAccessRole(user.role, 'supplier')) return json(res, 403, { error: 'Supplier role required' });
      if (!hasDatabase()) return json(res, 200, { ok: true, mode: 'mock' });
      const body = await readBody(req);
      const docType = String(body.docType || '').trim();
      const fileUrl = String(body.fileUrl || '').trim();
      if (!docType || !fileUrl) return json(res, 400, { error: 'docType and fileUrl are required' });
      const profile = await sql`select id from supplier_profiles where user_id = ${user.user_id} limit 1;`;
      if (profile.rows.length === 0) return json(res, 400, { error: 'Complete onboarding profile first' });
      const inserted = await sql`insert into verification_documents (supplier_profile_id, doc_type, file_url, review_status) values (${profile.rows[0].id}, ${docType}, ${fileUrl}, 'pending') returning id, review_status;`;
      return json(res, 201, { ok: true, document: inserted.rows[0] });
    }

    return methodNotAllowed(res, ['GET', 'POST']);
  }

  json(res, 404, { error: 'Unknown suppliers operation' });
}, { rateLimitKey: 'suppliers-group', rateLimitMax: 120 });
