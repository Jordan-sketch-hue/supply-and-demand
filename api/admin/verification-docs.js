const { json, methodNotAllowed, withApiGuard } = require('../_lib/http');
const { hasDatabase, sql } = require('../_lib/db');
const { requireUser, canAccessRole } = require('../_lib/auth');

module.exports = withApiGuard(async function handler(req, res) {
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET']);
    return;
  }

  const user = await requireUser(req);
  if (!user || !canAccessRole(user.role, 'admin')) {
    json(res, 403, { error: 'Admin access required' });
    return;
  }

  if (!hasDatabase()) {
    json(res, 200, { documents: [] });
    return;
  }

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
    select d.id, d.doc_type, d.file_url, d.review_status, d.reviewer_notes, d.created_at,
           p.business_name, u.email as supplier_email
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

  json(res, 200, {
    documents: result.rows,
    pagination: {
      page,
      pageSize,
      total: countResult.rows[0].total,
      totalPages: Math.max(1, Math.ceil(countResult.rows[0].total / pageSize))
    }
  });
}, { rateLimitKey: 'admin-verification-list', rateLimitMax: 120 });
