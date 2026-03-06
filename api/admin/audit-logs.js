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
    json(res, 200, {
      logs: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 }
    });
    return;
  }

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

  json(res, 200, {
    logs: result.rows,
    pagination: {
      page,
      pageSize,
      total: countResult.rows[0].total,
      totalPages: Math.max(1, Math.ceil(countResult.rows[0].total / pageSize))
    }
  });
}, { rateLimitKey: 'admin-audit-logs', rateLimitMax: 120 });
