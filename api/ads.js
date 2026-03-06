const { json, readBody, methodNotAllowed, withApiGuard } = require('../server/lib/http');
const { hasDatabase, sql } = require('../server/lib/db');
const { validateCsrf } = require('../server/lib/csrf');

const placements = [
  { key: 'homepage_hero', label: 'Homepage Hero Banner', page: 'Home', priority: 'highest' },
  { key: 'homepage_mid', label: 'Homepage Mid-Content Card', page: 'Home', priority: 'high' },
  { key: 'search_sidebar', label: 'Search Sidebar Sponsored Block', page: 'Search Demand', priority: 'high' },
  { key: 'browse_grid', label: 'Browse Supply Inline Slot', page: 'Browse Supply', priority: 'high' },
  { key: 'category_feature', label: 'Category Page Featured Banner', page: 'Categories', priority: 'medium' },
  { key: 'supplier_cta', label: 'Supplier CTA Companion Placement', page: 'Home / Supplier', priority: 'medium' },
  { key: 'footer_brand', label: 'Footer Brand Spotlight', page: 'Sitewide', priority: 'low' }
];

module.exports = withApiGuard(async function handler(req, res) {
  const op = String(req.query.op || '').trim();

  if (op === 'placements') {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    json(res, 200, { placements });
    return;
  }

  if (op === 'list') {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    const placement = String(req.query.placement || '').trim();
    if (!hasDatabase()) {
      json(res, 200, { adverts: [{ id: 'demo-1', company_name: 'UrbanHome Plumbing', objective: 'Emergency plumbing same-day dispatch', placement: placement || 'homepage_mid', status: 'live' }] });
      return;
    }

    const result = placement
      ? await sql`select id, company_name, objective, placement, status from adverts where status in ('live', 'approved') and placement = ${placement} order by created_at desc limit 5;`
      : await sql`select id, company_name, objective, placement, status from adverts where status in ('live', 'approved') order by created_at desc limit 20;`;
    json(res, 200, { adverts: result.rows });
    return;
  }

  if (op === 'submit') {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    if (!validateCsrf(req)) {
      json(res, 403, { error: 'CSRF validation failed' });
      return;
    }

    const body = await readBody(req);
    if (String(body.website || '').trim()) {
      json(res, 400, { error: 'Bot detection triggered' });
      return;
    }

    const payload = {
      companyName: String(body.companyName || '').trim(),
      contactName: String(body.contactName || '').trim(),
      contactEmail: String(body.contactEmail || '').trim().toLowerCase(),
      contactPhone: String(body.contactPhone || '').trim(),
      adCategory: String(body.adCategory || '').trim() || 'Local Services',
      targetCity: String(body.targetCity || '').trim(),
      budgetUsd: Number(body.budgetUsd || 0),
      sourceChannel: String(body.sourceChannel || '').trim(),
      objective: String(body.objective || '').trim(),
      creativeSummary: String(body.creativeSummary || '').trim(),
      placement: String(body.placement || 'homepage_hero').trim()
    };

    if (!payload.companyName || !payload.contactEmail || !payload.objective) {
      json(res, 400, { error: 'Company, contact email, and campaign objective are required' });
      return;
    }

    if (!hasDatabase()) {
      json(res, 200, { ok: true, mode: 'mock', status: 'pending' });
      return;
    }

    const inserted = await sql`
      insert into adverts (company_name, contact_name, contact_email, contact_phone, ad_category, target_city, budget_usd, source_channel, objective, creative_summary, placement, status)
      values (${payload.companyName}, ${payload.contactName || null}, ${payload.contactEmail}, ${payload.contactPhone || null}, ${payload.adCategory}, ${payload.targetCity || null}, ${payload.budgetUsd || null}, ${payload.sourceChannel || null}, ${payload.objective}, ${payload.creativeSummary || null}, ${payload.placement}, 'pending')
      returning id, status;
    `;

    json(res, 201, { ok: true, submission: inserted.rows[0] });
    return;
  }

  json(res, 404, { error: 'Unknown ads operation' });
}, { rateLimitKey: 'ads-group', rateLimitMax: 120 });
