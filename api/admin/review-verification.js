const { json, readBody, methodNotAllowed, withApiGuard } = require('../_lib/http');
const { hasDatabase, sql, writeAdminAuditLog } = require('../_lib/db');
const { requireUser, canAccessRole } = require('../_lib/auth');
const { validateCsrf } = require('../_lib/security/csrf');

const allowed = new Set(['approved', 'rejected']);

module.exports = withApiGuard(async function handler(req, res) {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST']);
    return;
  }

  if (!validateCsrf(req)) {
    json(res, 403, { error: 'CSRF validation failed' });
    return;
  }

  const user = await requireUser(req);
  if (!user || !canAccessRole(user.role, 'admin')) {
    json(res, 403, { error: 'Admin access required' });
    return;
  }

  if (!hasDatabase()) {
    json(res, 200, { ok: true, mode: 'mock' });
    return;
  }

  const body = await readBody(req);
  const documentId = String(body.documentId || '').trim();
  const documentIds = Array.isArray(body.documentIds)
    ? body.documentIds.map(id => String(id).trim()).filter(Boolean)
    : [];
  const reviewStatus = String(body.reviewStatus || '').trim();
  const reviewerNotes = String(body.reviewerNotes || '').trim() || null;

  const targetIds = documentIds.length > 0 ? documentIds : documentId ? [documentId] : [];

  if (targetIds.length === 0 || !allowed.has(reviewStatus)) {
    json(res, 400, { error: 'Invalid verification review payload' });
    return;
  }

  const updated = await sql`
    update verification_documents
    set review_status = ${reviewStatus}, reviewer_notes = ${reviewerNotes}
    where id = any(${targetIds}::uuid[])
    returning id, review_status;
  `;

  if (updated.rows.length === 0) {
    json(res, 404, { error: 'Verification document not found' });
    return;
  }

  for (const row of updated.rows) {
    await writeAdminAuditLog({
      actorUserId: user.user_id,
      actorEmail: user.email,
      action: 'verification_status_update',
      entityType: 'verification_document',
      entityId: row.id,
      details: {
        reviewStatus,
        reviewerNotes,
        bulk: targetIds.length > 1
      }
    });
  }

  json(res, 200, {
    ok: true,
    document: updated.rows[0],
    documents: updated.rows,
    updatedCount: updated.rows.length
  });
}, { rateLimitKey: 'admin-verification-review', rateLimitMax: 100 });
