const { json, methodNotAllowed, withApiGuard } = require('../_lib/http');
const { requireUser } = require('../_lib/auth');

module.exports = withApiGuard(async function handler(req, res) {
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET']);
    return;
  }

  const user = await requireUser(req);
  if (!user) {
    json(res, 401, { error: 'Unauthorized' });
    return;
  }

  json(res, 200, {
    user: {
      id: user.user_id,
      email: user.email,
      full_name: user.full_name,
      role: user.role
    }
  });
});
