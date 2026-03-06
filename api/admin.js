const { json, readBody, methodNotAllowed, withApiGuard } = require('../server/lib/http');
const { hasDatabase, sql, runBootstrap, writeAdminAuditLog } = require('../server/lib/db');
const { requireUser, canAccessRole } = require('../server/lib/auth');
const { validateCsrf } = require('../server/lib/csrf');

const advertAllowed = new Set(['approved', 'rejected', 'live', 'paused']);
const verificationAllowed = new Set(['approved', 'rejected']);

module.exports = withApiGuard(async function handler(req, res) {
  const op = String(req.query.op || '').trim();

  if (op === 'bootstrap') {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    const incomingKey = req.headers['x-bootstrap-key'];
    const expectedKey = process.env.BOOTSTRAP_KEY;
    if (!expectedKey || incomingKey !== expectedKey) return json(res, 401, { error: 'Unauthorized bootstrap attempt' });
    if (!hasDatabase()) return json(res, 400, { error: 'Database not configured. Add Vercel Postgres first.' });
    await runBootstrap();
    return json(res, 200, { ok: true, message: 'Bootstrap completed.' });
  }

  const user = await requireUser(req);
  if (!user || !canAccessRole(user.role, 'admin')) {
    json(res, 403, { error: 'Admin access required' });
    return;
  }

  if (op === 'trust-queue') {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    if (!hasDatabase()) return json(res, 200, { cases: [] });
    const result = await sql`select id, case_type, severity, status, reference_id, summary, created_at from trust_cases order by created_at desc limit 200;`;
    return json(res, 200, { cases: result.rows });
  }

  if (op === 'adverts') {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    if (!hasDatabase()) return json(res, 200, { adverts: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 } });

    const q = String(req.query.q || '').trim().toLowerCase();
    const status = String(req.query.status || '').trim().toLowerCase();
    const placement = String(req.query.placement || '').trim().toLowerCase();
    const from = String(req.query.from || '').trim();
    const to = String(req.query.to || '').trim();
    const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(String(req.query.pageSize || '20'), 10) || 20));
    const offset = (page - 1) * pageSize;
    const fromDate = from ? new Date(`${from}T00:00:00.000Z`) : null;
    const toDate = to ? new Date(`${to}T23:59:59.999Z`) : null;

    const countResult = await sql`
      select count(*)::int as total
      from adverts
      where (${q} = '' or lower(company_name) like ${`%${q}%`} or lower(contact_email) like ${`%${q}%`})
        and (${status} = '' or lower(status) = ${status})
        and (${placement} = '' or lower(placement) = ${placement})
        and (${fromDate ? fromDate.toISOString() : null}::timestamptz is null or created_at >= ${fromDate ? fromDate.toISOString() : null}::timestamptz)
        and (${toDate ? toDate.toISOString() : null}::timestamptz is null or created_at <= ${toDate ? toDate.toISOString() : null}::timestamptz);
    `;

    const result = await sql`
      select id, company_name, contact_email, ad_category, target_city, budget_usd, placement, status, created_at
      from adverts
      where (${q} = '' or lower(company_name) like ${`%${q}%`} or lower(contact_email) like ${`%${q}%`})
        and (${status} = '' or lower(status) = ${status})
        and (${placement} = '' or lower(placement) = ${placement})
        and (${fromDate ? fromDate.toISOString() : null}::timestamptz is null or created_at >= ${fromDate ? fromDate.toISOString() : null}::timestamptz)
        and (${toDate ? toDate.toISOString() : null}::timestamptz is null or created_at <= ${toDate ? toDate.toISOString() : null}::timestamptz)
      order by created_at desc
      limit ${pageSize}
      offset ${offset};
    `;

    return json(res, 200, {
      adverts: result.rows,
      pagination: { page, pageSize, total: countResult.rows[0].total, totalPages: Math.max(1, Math.ceil(countResult.rows[0].total / pageSize)) }
    });
  }

  if (op === 'verification-docs') {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    if (!hasDatabase()) return json(res, 200, { documents: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 } });

    const q = String(req.query.q || '').trim().toLowerCase();
    const status = String(req.query.status || '').trim().toLowerCase();
    const from = String(req.query.from || '').trim();
    const to = String(req.query.to || '').trim();
    const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(String(req.query.pageSize || '20'), 10) || 20));
    const offset = (page - 1) * pageSize;
    const fromDate = from ? new Date(`${from}T00:00:00.000Z`) : null;
    const toDate = to ? new Date(`${to}T23:59:59.999Z`) : null;

    const countResult = await sql`
      select count(*)::int as total
      from verification_documents d
      join supplier_profiles p on p.id = d.supplier_profile_id
      join auth_users u on u.id = p.user_id
      where (${q} = '' or lower(p.business_name) like ${`%${q}%`} or lower(u.email) like ${`%${q}%`} or lower(d.doc_type) like ${`%${q}%`})
        and (${status} = '' or lower(d.review_status) = ${status})
        and (${fromDate ? fromDate.toISOString() : null}::timestamptz is null or d.created_at >= ${fromDate ? fromDate.toISOString() : null}::timestamptz)
        and (${toDate ? toDate.toISOString() : null}::timestamptz is null or d.created_at <= ${toDate ? toDate.toISOString() : null}::timestamptz);
    `;

    const result = await sql`
      select d.id, d.doc_type, d.file_url, d.review_status, d.reviewer_notes, d.created_at, p.business_name, u.email as supplier_email
      from verification_documents d
      join supplier_profiles p on p.id = d.supplier_profile_id
      join auth_users u on u.id = p.user_id
      where (${q} = '' or lower(p.business_name) like ${`%${q}%`} or lower(u.email) like ${`%${q}%`} or lower(d.doc_type) like ${`%${q}%`})
        and (${status} = '' or lower(d.review_status) = ${status})
        and (${fromDate ? fromDate.toISOString() : null}::timestamptz is null or d.created_at >= ${fromDate ? fromDate.toISOString() : null}::timestamptz)
        and (${toDate ? toDate.toISOString() : null}::timestamptz is null or d.created_at <= ${toDate ? toDate.toISOString() : null}::timestamptz)
      order by d.created_at desc
      limit ${pageSize}
      offset ${offset};
    `;

    return json(res, 200, {
      documents: result.rows,
      pagination: { page, pageSize, total: countResult.rows[0].total, totalPages: Math.max(1, Math.ceil(countResult.rows[0].total / pageSize)) }
    });
  }

  if (op === 'review-advert') {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    if (!validateCsrf(req)) return json(res, 403, { error: 'CSRF validation failed' });
    if (!hasDatabase()) return json(res, 200, { ok: true, mode: 'mock' });

    const body = await readBody(req);
    const advertId = String(body.advertId || '').trim();
    const advertIds = Array.isArray(body.advertIds) ? body.advertIds.map(id => String(id).trim()).filter(Boolean) : [];
    const status = String(body.status || '').trim();
    const targetIds = advertIds.length > 0 ? advertIds : advertId ? [advertId] : [];
    if (targetIds.length === 0 || !advertAllowed.has(status)) return json(res, 400, { error: 'Invalid advert review payload' });

    const updated = await sql`update adverts set status = ${status} where id = any(${targetIds}::uuid[]) returning id, status;`;
    if (updated.rows.length === 0) return json(res, 404, { error: 'Advert not found' });

    for (const row of updated.rows) {
      await writeAdminAuditLog({ actorUserId: user.user_id, actorEmail: user.email, action: 'advert_status_update', entityType: 'advert', entityId: row.id, details: { status, bulk: targetIds.length > 1 } });
    }

    return json(res, 200, { ok: true, advert: updated.rows[0], adverts: updated.rows, updatedCount: updated.rows.length });
  }

  if (op === 'review-verification') {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    if (!validateCsrf(req)) return json(res, 403, { error: 'CSRF validation failed' });
    if (!hasDatabase()) return json(res, 200, { ok: true, mode: 'mock' });

    const body = await readBody(req);
    const documentId = String(body.documentId || '').trim();
    const documentIds = Array.isArray(body.documentIds) ? body.documentIds.map(id => String(id).trim()).filter(Boolean) : [];
    const reviewStatus = String(body.reviewStatus || '').trim();
    const reviewerNotes = String(body.reviewerNotes || '').trim() || null;
    const targetIds = documentIds.length > 0 ? documentIds : documentId ? [documentId] : [];
    if (targetIds.length === 0 || !verificationAllowed.has(reviewStatus)) return json(res, 400, { error: 'Invalid verification review payload' });

    const updated = await sql`update verification_documents set review_status = ${reviewStatus}, reviewer_notes = ${reviewerNotes} where id = any(${targetIds}::uuid[]) returning id, review_status;`;
    if (updated.rows.length === 0) return json(res, 404, { error: 'Verification document not found' });

    for (const row of updated.rows) {
      await writeAdminAuditLog({ actorUserId: user.user_id, actorEmail: user.email, action: 'verification_status_update', entityType: 'verification_document', entityId: row.id, details: { reviewStatus, reviewerNotes, bulk: targetIds.length > 1 } });
    }

    return json(res, 200, { ok: true, document: updated.rows[0], documents: updated.rows, updatedCount: updated.rows.length });
  }

  if (op === 'audit-logs') {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    if (!hasDatabase()) return json(res, 200, { logs: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 } });

    const q = String(req.query.q || '').trim().toLowerCase();
    const action = String(req.query.action || '').trim().toLowerCase();
    const entityType = String(req.query.entityType || '').trim().toLowerCase();
    const from = String(req.query.from || '').trim();
    const to = String(req.query.to || '').trim();
    const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(String(req.query.pageSize || '20'), 10) || 20));
    const offset = (page - 1) * pageSize;
    const fromDate = from ? new Date(`${from}T00:00:00.000Z`) : null;
    const toDate = to ? new Date(`${to}T23:59:59.999Z`) : null;

    const countResult = await sql`
      select count(*)::int as total
      from admin_audit_logs
      where (${q} = '' or lower(coalesce(actor_email, '')) like ${`%${q}%`} or lower(coalesce(entity_id, '')) like ${`%${q}%`})
        and (${action} = '' or lower(action) = ${action})
        and (${entityType} = '' or lower(entity_type) = ${entityType})
        and (${fromDate ? fromDate.toISOString() : null}::timestamptz is null or created_at >= ${fromDate ? fromDate.toISOString() : null}::timestamptz)
        and (${toDate ? toDate.toISOString() : null}::timestamptz is null or created_at <= ${toDate ? toDate.toISOString() : null}::timestamptz);
    `;

    const result = await sql`
      select id, actor_user_id, actor_email, action, entity_type, entity_id, details, created_at
      from admin_audit_logs
      where (${q} = '' or lower(coalesce(actor_email, '')) like ${`%${q}%`} or lower(coalesce(entity_id, '')) like ${`%${q}%`})
        and (${action} = '' or lower(action) = ${action})
        and (${entityType} = '' or lower(entity_type) = ${entityType})
        and (${fromDate ? fromDate.toISOString() : null}::timestamptz is null or created_at >= ${fromDate ? fromDate.toISOString() : null}::timestamptz)
        and (${toDate ? toDate.toISOString() : null}::timestamptz is null or created_at <= ${toDate ? toDate.toISOString() : null}::timestamptz)
      order by created_at desc
      limit ${pageSize}
      offset ${offset};
    `;

    return json(res, 200, { logs: result.rows, pagination: { page, pageSize, total: countResult.rows[0].total, totalPages: Math.max(1, Math.ceil(countResult.rows[0].total / pageSize)) } });
  }

  json(res, 404, { error: 'Unknown admin operation' });
}, { rateLimitKey: 'admin-group', rateLimitMax: 160 });
