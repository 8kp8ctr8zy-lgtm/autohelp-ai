// Netlify Function: redirects to an approved Lemon Squeezy hosted checkout.
// Set LEMONSQUEEZY_CHECKOUT_URL in Netlify environment variables.
// This is a checkout handoff, NOT a subscription entitlement check.
exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: { Allow: 'GET', 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  const raw = process.env.LEMONSQUEEZY_CHECKOUT_URL;
  if (!raw) {
    return { statusCode: 503, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify({ error: 'Подписка пока недоступна: магазин ещё не настроен.' }) };
  }
  let url;
  try { url = new URL(raw); } catch (_) {
    return { statusCode: 500, body: 'Invalid checkout configuration' };
  }
  if (url.protocol !== 'https:' || !(url.hostname === 'lemonsqueezy.com' || url.hostname.endsWith('.lemonsqueezy.com'))) {
    return { statusCode: 500, body: 'Invalid checkout host' };
  }
  return { statusCode: 302, headers: { Location: url.toString(), 'Cache-Control': 'no-store' }, body: '' };
};
