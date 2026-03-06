const crypto = require('crypto');

function issueCsrfToken() {
  return crypto.randomBytes(24).toString('hex');
}

function validateCsrf(req) {
  const method = req.method || 'GET';
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return true;
  }

  const headerToken = req.headers['x-csrf-token'];
  const cookieToken = req.headers['x-csrf-cookie'];
  if (!headerToken || !cookieToken) {
    return false;
  }

  return String(headerToken) === String(cookieToken);
}

module.exports = {
  issueCsrfToken,
  validateCsrf
};
