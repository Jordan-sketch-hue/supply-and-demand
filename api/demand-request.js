const { json, readBody, methodNotAllowed, withApiGuard } = require('./_lib/http');
const { sql, hasDatabase } = require('./_lib/db');
const { validateCsrf } = require('./_lib/security/csrf');

module.exports = withApiGuard(async function handler(req, res) {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST']);
    return;
  }

  if (!validateCsrf(req)) {
    json(res, 403, { error: 'CSRF validation failed' });
    return;
  }

  try {
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
      json(res, 200, {
        ok: true,
        id: 'local-preview',
        mode: 'mock',
        message: 'Request accepted in preview mode. Connect Vercel Postgres to persist.'
      });
      return;
    }

    const inserted = await sql`
      insert into demand_requests (raw_query, category, urgency, country, city, neighborhood, details)
      values (${rawQuery}, ${category}, ${urgency}, ${country}, ${city}, ${neighborhood}, ${details})
      returning id;
    `;

    json(res, 200, {
      ok: true,
      id: inserted.rows[0].id,
      mode: 'database'
    });
  } catch (error) {
    json(res, 500, {
      error: 'Could not submit demand request',
      details: error.message
    });
  }
}, { rateLimitKey: 'demand-request', rateLimitMax: 50 });
