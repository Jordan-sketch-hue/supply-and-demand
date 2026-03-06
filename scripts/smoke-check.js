const fs = require('fs');
const path = require('path');

const required = [
  'public/index.html',
  'public/pages/adverts.html',
  'public/pages/admin-console.html',
  'api/auth/login.js',
  'api/auth/signup.js',
  'api/payments/create-intent.js',
  'api/payments/webhook.js',
  'api/admin/trust-queue.js'
];

let failures = 0;
for (const rel of required) {
  const full = path.join(process.cwd(), rel);
  if (!fs.existsSync(full)) {
    console.error(`Missing required file: ${rel}`);
    failures += 1;
  }
}

if (failures > 0) {
  process.exit(1);
}

console.log('Smoke check passed.');
