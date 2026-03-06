const { json, methodNotAllowed, withApiGuard } = require('../server/lib/http');
const { hasDatabase, sql } = require('../server/lib/db');
const { requireUser, canAccessRole } = require('../server/lib/auth');

module.exports = withApiGuard(async function handler(req, res) {
  const op = String(req.query.op || '').trim();
  if (op !== 'metrics') {
    json(res, 404, { error: 'Unknown ops operation' });
    return;
  }

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
    json(res, 200, { mode: 'mock', uptimeSeconds: Math.round(process.uptime()), nodeVersion: process.version, now: new Date().toISOString() });
    return;
  }

  const [users, bookings, adverts, trustCases] = await Promise.all([
    sql`select count(*)::int as total from auth_users;`,
    sql`select count(*)::int as total from bookings;`,
    sql`select count(*)::int as total from adverts;`,
    sql`select count(*)::int as total from trust_cases where status <> 'resolved';`
  ]);

  json(res, 200, {
    uptimeSeconds: Math.round(process.uptime()),
    nodeVersion: process.version,
    now: new Date().toISOString(),
    totals: {
      users: users.rows[0].total,
      bookings: bookings.rows[0].total,
      adverts: adverts.rows[0].total,
      openTrustCases: trustCases.rows[0].total
    }
  });
}, { rateLimitKey: 'ops-group', rateLimitMax: 50 });
