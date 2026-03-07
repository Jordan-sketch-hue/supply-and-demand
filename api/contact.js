// Contact API route for Supply & Demand
const { json, readBody, methodNotAllowed } = require('../server/lib/http');

// Email and WhatsApp notification config
const CONTACT_EMAIL = 'global.jsuprememarketing@gmail.com';
const CONTACT_PHONE = '658-218-2282';
const WHATSAPP_LINK = 'https://wa.me/16582182282';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const body = await readBody(req);
  // In production, send email to CONTACT_EMAIL and optionally WhatsApp notification
  // For now, just log and return success
  console.log('Contact form submission:', body);
  // TODO: Integrate with email service (e.g., nodemailer, SendGrid, etc.)
  return json(res, 200, { ok: true, email: CONTACT_EMAIL, whatsapp: WHATSAPP_LINK });
};
