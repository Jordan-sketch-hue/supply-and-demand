const { json, readBody, methodNotAllowed, withApiGuard } = require('../_lib/http');
const { hasDatabase, sql } = require('../_lib/db');
const { requireUser, canAccessRole } = require('../_lib/auth');
const { validateCsrf } = require('../_lib/security/csrf');

module.exports = withApiGuard(async function handler(req, res) {
  if (req.method === 'POST') {
    if (!validateCsrf(req)) {
      json(res, 403, { error: 'CSRF validation failed' });
      return;
    }

    const user = await requireUser(req);
    if (!user || !canAccessRole(user.role, 'supplier')) {
      json(res, 403, { error: 'Supplier role required' });
      return;
    }

    if (!hasDatabase()) {
      json(res, 200, { ok: true, mode: 'mock' });
      return;
    }

    const body = await readBody(req);
    const docType = String(body.docType || '').trim();
    const fileUrl = String(body.fileUrl || '').trim();

    if (!docType || !fileUrl) {
      json(res, 400, { error: 'docType and fileUrl are required' });
      return;
    }

    const profile = await sql`select id from supplier_profiles where user_id = ${user.user_id} limit 1;`;
    if (profile.rows.length === 0) {
      json(res, 400, { error: 'Complete onboarding profile first' });
      return;
    }

    const inserted = await sql`
      insert into verification_documents (supplier_profile_id, doc_type, file_url, review_status)
      values (${profile.rows[0].id}, ${docType}, ${fileUrl}, 'pending')
      returning id, review_status;
    `;

    json(res, 201, { ok: true, document: inserted.rows[0] });
    return;
  }

  if (req.method === 'GET') {
    const user = await requireUser(req);
    if (!user) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }

    if (!hasDatabase()) {
      json(res, 200, { documents: [] });
      return;
    }

    const profile = await sql`select id from supplier_profiles where user_id = ${user.user_id} limit 1;`;
    if (profile.rows.length === 0) {
      json(res, 200, { documents: [] });
      return;
    }

    const docs = await sql`
      select id, doc_type, file_url, review_status, reviewer_notes, created_at
      from verification_documents
      where supplier_profile_id = ${profile.rows[0].id}
      order by created_at desc;
    `;

    json(res, 200, { documents: docs.rows });
    return;
  }

  methodNotAllowed(res, ['GET', 'POST']);
}, { rateLimitKey: 'suppliers-documents', rateLimitMax: 80 });
