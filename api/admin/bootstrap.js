const { json, methodNotAllowed, withApiGuard } = require('../_lib/http');
const { hasDatabase, runBootstrap } = require('../_lib/db');

module.exports = withApiGuard(async function handler(req, res) {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST']);
    return;
  }

  const incomingKey = req.headers['x-bootstrap-key'];
  const expectedKey = process.env.BOOTSTRAP_KEY;

  if (!expectedKey || incomingKey !== expectedKey) {
    json(res, 401, { error: 'Unauthorized bootstrap attempt' });
    return;
  }

  if (!hasDatabase()) {
    json(res, 400, { error: 'Database not configured. Add Vercel Postgres first.' });
    return;
  }

  try {
    await runBootstrap();
    json(res, 200, { ok: true, message: 'Bootstrap completed.' });
  } catch (error) {
    json(res, 500, { error: 'Bootstrap failed', details: error.message });
  }
}, { rateLimitKey: 'admin-bootstrap', rateLimitMax: 10 });
