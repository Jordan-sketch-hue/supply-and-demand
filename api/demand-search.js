const { json, methodNotAllowed, withApiGuard } = require('./_lib/http');
const { sql, hasDatabase } = require('./_lib/db');
const { suppliers: mockSuppliers } = require('./_lib/mock-data');

module.exports = withApiGuard(async function handler(req, res) {
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET']);
    return;
  }

  const query = String(req.query.q || '').trim();
  const city = String(req.query.city || '').trim();
  const normalized = query.toLowerCase();

  if (!query) {
    json(res, 400, { error: 'Missing query parameter q' });
    return;
  }

  try {
    let rows = [];
    if (hasDatabase()) {
      const queryPattern = `%${normalized}%`;
      const cityPattern = `%${city.toLowerCase()}%`;

      const result = city
        ? await sql`
            select id, business_name, service_title, city, trust_score, distance_km, available_minutes, verified_badge
            from suppliers
            where lower(service_title) like ${queryPattern}
               or lower(business_name) like ${queryPattern}
               or lower(city) like ${cityPattern}
            order by verified_badge desc, trust_score desc, available_minutes asc
            limit 12;
          `
        : await sql`
            select id, business_name, service_title, city, trust_score, distance_km, available_minutes, verified_badge
            from suppliers
            where lower(service_title) like ${queryPattern}
               or lower(business_name) like ${queryPattern}
            order by verified_badge desc, trust_score desc, available_minutes asc
            limit 12;
          `;
      rows = result.rows;

      await sql`
        insert into saved_searches (query_text, city)
        values (${query}, ${city || null});
      `;
    } else {
      rows = mockSuppliers.filter(item => {
        const blob = `${item.business_name} ${item.service_title} ${item.city}`.toLowerCase();
        return blob.includes(normalized);
      });
    }

    if (rows.length === 0) {
      rows = hasDatabase() ? [] : mockSuppliers;
    }

    json(res, 200, {
      query,
      city,
      count: rows.length,
      results: rows
    });
  } catch (error) {
    json(res, 500, {
      error: 'Search request failed',
      details: error.message
    });
  }
}, { rateLimitKey: 'demand-search', rateLimitMax: 150 });
