const { json, methodNotAllowed, withApiGuard } = require('../server/lib/http');
const { hasDatabase } = require('../server/lib/db');

module.exports = withApiGuard(async function handler(req, res) {
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET']);
    return;
  }

  json(res, 200, {
    ok: true,
    service: 'Supply & Demand API',
    databaseConfigured: hasDatabase(),
    now: new Date().toISOString()
  });
});
