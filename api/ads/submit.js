const { json, readBody, methodNotAllowed, withApiGuard } = require('../_lib/http');
const { hasDatabase, sql } = require('../_lib/db');
const { validateCsrf } = require('../_lib/security/csrf');

const validPlacements = new Set([
  'homepage_hero',
  'homepage_mid',
  'search_sidebar',
  'browse_grid',
  'category_feature',
  'supplier_cta',
  'footer_brand'
]);

module.exports = withApiGuard(async function handler(req, res) {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST']);
    return;
  }

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

  if (!validPlacements.has(payload.placement)) {
    json(res, 400, { error: 'Invalid ad placement selection' });
    return;
  }

  if (!hasDatabase()) {
    json(res, 200, {
      ok: true,
      mode: 'mock',
      status: 'pending',
      message: 'Ad submission captured in preview mode. Connect database for persistence.'
    });
    return;
  }

  const inserted = await sql`
    insert into adverts (
      company_name, contact_name, contact_email, contact_phone,
      ad_category, target_city, budget_usd, source_channel,
      objective, creative_summary, placement, status
    )
    values (
      ${payload.companyName}, ${payload.contactName || null}, ${payload.contactEmail}, ${payload.contactPhone || null},
      ${payload.adCategory}, ${payload.targetCity || null}, ${payload.budgetUsd || null}, ${payload.sourceChannel || null},
      ${payload.objective}, ${payload.creativeSummary || null}, ${payload.placement}, 'pending'
    )
    returning id, status;
  `;

  json(res, 201, {
    ok: true,
    submission: inserted.rows[0]
  });
}, { rateLimitKey: 'ads-submit', rateLimitMax: 20 });
