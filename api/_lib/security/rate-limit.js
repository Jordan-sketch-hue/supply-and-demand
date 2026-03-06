const buckets = new Map();

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

function rateLimit({ req, res, keyPrefix, max = 60, windowMs = 60_000 }) {
  const now = Date.now();
  const ip = getClientIp(req);
  const key = `${keyPrefix}:${ip}`;
  const current = buckets.get(key);

  if (!current || now > current.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1 };
  }

  if (current.count >= max) {
    const retryAfter = Math.ceil((current.resetAt - now) / 1000);
    res.setHeader('Retry-After', String(retryAfter));
    return { allowed: false, remaining: 0, retryAfter };
  }

  current.count += 1;
  buckets.set(key, current);
  return { allowed: true, remaining: max - current.count };
}

module.exports = {
  rateLimit,
  getClientIp
};
