const { json, methodNotAllowed, withApiGuard } = require('../_lib/http');
const { hasDatabase, sql } = require('../_lib/db');
const { requireUser } = require('../_lib/auth');

module.exports = withApiGuard(async function handler(req, res) {
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET']);
    return;
  }

  const user = await requireUser(req);
  if (!user) {
    json(res, 401, { error: 'Unauthorized' });
    return;
  }

  if (!hasDatabase()) {
    json(res, 200, { bookings: [] });
    return;
  }

  const result = user.role === 'admin'
    ? await sql`select id, status, scheduled_at, created_at from bookings order by created_at desc limit 50;`
    : await sql`
        select id, status, scheduled_at, created_at
        from bookings
        where consumer_user_id = ${user.user_id} or supplier_user_id = ${user.user_id}
        order by created_at desc
        limit 50;
      `;

  json(res, 200, { bookings: result.rows });
});
