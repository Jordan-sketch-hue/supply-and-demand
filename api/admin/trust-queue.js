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
    json(res, 200, { cases: [] });
    return;
  }

  const result = await sql`
    select id, case_type, severity, status, reference_id, summary, created_at
    from trust_cases
    order by created_at desc
    limit 200;
  `;

  json(res, 200, { cases: result.rows });
}, { rateLimitKey: 'admin-trust', rateLimitMax: 100 });
