const { applySecurityHeaders } = require('./headers');
const { rateLimit } = require('./rate-limit');

function json(res, statusCode, payload) {
  applySecurityHeaders(res);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  if (typeof req.body === 'object' && req.body !== null) {
    return req.body;
  }

  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1_000_000) reject(new Error('Body too large'));
    });
    req.on('end', () => {
      if (!data.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function methodNotAllowed(res, allowedMethods) {
  res.setHeader('Allow', allowedMethods.join(', '));
  json(res, 405, { error: 'Method not allowed' });
}

function withApiGuard(handler, options = {}) {
  const { rateLimitKey = 'api', rateLimitMax = 100, rateLimitWindowMs = 60_000 } = options;

  return async function wrapped(req, res) {
    const rl = rateLimit({ req, res, keyPrefix: rateLimitKey, max: rateLimitMax, windowMs: rateLimitWindowMs });
    if (!rl.allowed) {
      json(res, 429, { error: 'Too many requests', retryAfterSeconds: rl.retryAfter || 60 });
      return;
    }

    try {
      await handler(req, res);
    } catch (error) {
      json(res, 500, { error: 'Unhandled API error', details: error.message });
    }
  };
}

module.exports = {
  json,
  readBody,
  methodNotAllowed,
  withApiGuard
};
