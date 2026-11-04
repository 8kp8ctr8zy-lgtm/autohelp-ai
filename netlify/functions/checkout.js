// Redirect to the public AutoHelp AI PRO Lemon Squeezy checkout.
// Optional Netlify env override: LEMONSQUEEZY_CHECKOUT_URL.
// This endpoint does not grant PRO access; verified webhooks are required.
const DEFAULT_CHECKOUT_URL = 'https://autohelp-ai.lemonsqueezy.com/checkout/buy/8baac202-95f1-4b01-abb5-e3050d83f4bd';

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: { Allow: 'GET' }, body: 'Method not allowed' };
  }
  let url;
  try { url = new URL(process.env.LEMONSQUEEZY_CHECKOUT_URL || DEFAULT_CHECKOUT_URL); }
  catch (_) { return { statusCode: 500, body: 'Invalid checkout configuration' }; }
  if (url.protocol !== 'https:' || !(url.hostname === 'lemonsqueezy.com' || url.hostname.endsWith('.lemonsqueezy.com'))) {
    return { statusCode: 500, body: 'Invalid checkout host' };
  }
  return { statusCode: 302, headers: { Location: url.toString(), 'Cache-Control': 'no-store' }, body: '' };
};
