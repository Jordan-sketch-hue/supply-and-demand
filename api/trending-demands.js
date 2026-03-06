const { json, methodNotAllowed, withApiGuard } = require('./_lib/http');
const { sql, hasDatabase } = require('./_lib/db');

module.exports = withApiGuard(async function handler(req, res) {
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET']);
    return;
  }

  try {
    if (!hasDatabase()) {
      json(res, 200, {
        trends: [
          { query_text: 'I need a plumber', city: 'Kingston', demand_count: 42 },
          { query_text: 'Find me a mechanic', city: 'Montego Bay', demand_count: 31 },
          { query_text: 'I need catering', city: 'Miami', demand_count: 24 }
        ]
      });
      return;
    }

    const result = await sql`
      select query_text, coalesce(city, 'Any City') as city, count(*)::int as demand_count
      from saved_searches
      group by query_text, city
      order by demand_count desc, query_text asc
      limit 5;
    `;

    json(res, 200, { trends: result.rows });
  } catch (error) {
    json(res, 500, {
      error: 'Could not load demand trends',
      details: error.message
    });
  }
}, { rateLimitKey: 'trending-demands', rateLimitMax: 120 });
