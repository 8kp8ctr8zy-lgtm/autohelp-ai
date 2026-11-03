// Lemon Squeezy webhook receiver. Never trust an unsigned notification.
// Configure LEMONSQUEEZY_WEBHOOK_SECRET in Netlify and the same secret in Lemon Squeezy.
// Subscription access must NOT be granted until the event is linked to an authenticated user
// and persisted in a database. This endpoint only verifies and acknowledges notifications.
const crypto = require('node:crypto');
const supported = new Set([
  'subscription_created', 'subscription_updated', 'subscription_cancelled',
  'subscription_resumed', 'subscription_expired', 'subscription_paused',
  'subscription_unpaused', 'subscription_payment_success',
  'subscription_payment_failed', 'subscription_payment_recovered'
]);
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { Allow: 'POST' }, body: 'Method not allowed' };
  }
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) {
    return { statusCode: 503, body: 'Webhook not configured' };
  }
  const signature = event.headers?.['x-signature'] || event.headers?.['X-Signature'] || '';
  if (!/^[a-f0-9]{64}$/i.test(signature)) {
    return { statusCode: 401, body: 'Invalid signature' };
  }
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64')
    : Buffer.from(event.body || '', 'utf8');
  const expected = crypto.createHmac('sha256', secret).update(raw).digest();
  const received = Buffer.from(signature, 'hex');
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
    return { statusCode: 401, body: 'Invalid signature' };
  }
  let payload;
  try { payload = JSON.parse(raw.toString('utf8')); }
  catch { return { statusCode: 400, body: 'Invalid JSON' }; }
  const name = payload?.meta?.event_name;
  if (typeof name !== 'string') return { statusCode: 400, body: 'Missing event name' };
  // Do not log customer details, tokens, or payment data.
  console.info('Verified Lemon Squeezy webhook:', {
    event: name,
    supported: supported.has(name),
    resource: payload?.data?.type || 'unknown'
  });
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify({ received: true })
  };
};
