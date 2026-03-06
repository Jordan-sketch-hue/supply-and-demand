const { json, methodNotAllowed, withApiGuard } = require('../_lib/http');
const { hasDatabase, sql } = require('../_lib/db');

module.exports = withApiGuard(async function handler(req, res) {
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET']);
    return;
  }

  const placement = String(req.query.placement || '').trim();

  if (!hasDatabase()) {
    json(res, 200, {
      adverts: [
        {
          id: 'demo-1',
          company_name: 'UrbanHome Plumbing',
          objective: 'Emergency plumbing same-day dispatch',
          placement: placement || 'homepage_mid',
          status: 'live'
        }
      ]
    });
    return;
  }

  const result = placement
    ? await sql`
        select id, company_name, objective, placement, status
        from adverts
        where status in ('live', 'approved') and placement = ${placement}
        order by created_at desc
        limit 5;
      `
    : await sql`
        select id, company_name, objective, placement, status
        from adverts
        where status in ('live', 'approved')
        order by created_at desc
        limit 20;
      `;

  json(res, 200, { adverts: result.rows });
});
