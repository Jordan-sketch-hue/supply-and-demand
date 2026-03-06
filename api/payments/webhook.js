const { json, withApiGuard } = require('../_lib/http');
const { hasDatabase, sql } = require('../_lib/db');

let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

module.exports = withApiGuard(async function handler(req, res) {
  if (req.method !== 'POST') {
    json(res, 405, { error: 'Method not allowed' });
    return;
  }

  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    json(res, 200, { ok: true, mode: 'mock', note: 'Stripe not configured' });
    return;
  }

  const sig = req.headers['stripe-signature'];
  let raw = '';
  await new Promise((resolve, reject) => {
    req.on('data', chunk => {
      raw += chunk;
    });
    req.on('end', resolve);
    req.on('error', reject);
  });

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    json(res, 400, { error: `Webhook signature failed: ${error.message}` });
    return;
  }

  if (hasDatabase()) {
    await sql`
      insert into webhook_events (provider, event_id, event_type, payload, processed)
      values ('stripe', ${event.id}, ${event.type}, ${JSON.stringify(event)}, false)
      on conflict (provider, event_id) do nothing;
    `;
  }

  if (event.type === 'payment_intent.succeeded' && hasDatabase()) {
    const intentId = event.data.object.id;
    await sql`
      update escrow_transactions
      set status = 'held'
      where stripe_payment_intent_id = ${intentId};
    `;
  }

  if (event.type === 'charge.refunded' && hasDatabase()) {
    const paymentIntentId = event.data.object.payment_intent;
    await sql`
      update escrow_transactions
      set status = 'refunded'
      where stripe_payment_intent_id = ${paymentIntentId};
    `;
  }

  if (hasDatabase()) {
    await sql`
      update webhook_events
      set processed = true
      where provider = 'stripe' and event_id = ${event.id};
    `;
  }

  json(res, 200, { received: true });
}, { rateLimitKey: 'stripe-webhook', rateLimitMax: 300 });
