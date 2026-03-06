const { json, readBody, methodNotAllowed, withApiGuard } = require('../server/lib/http');
const { sql, hasDatabase } = require('../server/lib/db');
const { validateCsrf } = require('../server/lib/csrf');
const { suppliers: mockSuppliers } = require('../server/lib/mock-data');

module.exports = withApiGuard(async function handler(req, res) {
  const op = String(req.query.op || 'search').trim();

  if (op === 'search') {
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
      await sql`insert into saved_searches (query_text, city) values (${query}, ${city || null});`;
    } else {
      rows = mockSuppliers.filter(item => {
        const blob = `${item.business_name} ${item.service_title} ${item.city}`.toLowerCase();
        return blob.includes(normalized);
      });
      if (rows.length === 0) rows = mockSuppliers;
    }

    json(res, 200, { query, city, count: rows.length, results: rows });
    return;
  }

  if (op === 'request') {
    if (req.method !== 'POST') {
      methodNotAllowed(res, ['POST']);
      return;
    }

    if (!validateCsrf(req)) {
      json(res, 403, { error: 'CSRF validation failed' });
      return;
    }

    const body = await readBody(req);
    const rawQuery = String(body.rawQuery || '').trim();
    const category = String(body.category || '').trim() || 'Services';
    const urgency = String(body.urgency || '').trim() || 'Standard';
    const country = String(body.country || '').trim() || null;
    const city = String(body.city || '').trim() || null;
    const neighborhood = String(body.neighborhood || '').trim() || null;
    const details = String(body.details || '').trim() || null;

    if (!rawQuery) {
      json(res, 400, { error: 'rawQuery is required' });
      return;
    }

    if (!hasDatabase()) {
      json(res, 200, { ok: true, id: 'local-preview', mode: 'mock' });
      return;
    }

    const inserted = await sql`
      insert into demand_requests (raw_query, category, urgency, country, city, neighborhood, details)
      values (${rawQuery}, ${category}, ${urgency}, ${country}, ${city}, ${neighborhood}, ${details})
      returning id;
    `;
    json(res, 200, { ok: true, id: inserted.rows[0].id, mode: 'database' });
    return;
  }

  if (op === 'trending') {
    if (req.method !== 'GET') {
      methodNotAllowed(res, ['GET']);
      return;
    }

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
    return;
  }

  json(res, 404, { error: 'Unknown demand operation' });
}, { rateLimitKey: 'demand-group', rateLimitMax: 180 });
