# Lemon Squeezy payment integration plan

Status: preparation only. Payments are not active.

## Required merchant setup
1. Complete Lemon Squeezy store verification and payout onboarding.
2. Create an AutoHelp AI subscription product and monthly variant.
3. Obtain the hosted checkout URL for the variant.
4. Configure a webhook endpoint for subscription lifecycle events and save its signing secret in server-side environment variables.

## Application implementation
- Add a pricing page and a Subscribe button that opens the official hosted checkout URL.
- Implement a server-side webhook endpoint; verify the X-Signature HMAC SHA-256 against the raw request body before processing events.
- Store Lemon Squeezy customer and subscription identifiers, statuses, and renewal/expiration dates in the application database.
- Grant paid features only after a verified subscription event; handle cancellation, expiration, and failed payments.
- Keep API keys, webhook signing secrets, and any private credentials out of GitHub source control and browser code.
- Test checkout and lifecycle events in test mode before activating live payments.

## Configuration placeholders (server-side unless noted)
- LEMONSQUEEZY_API_KEY
- LEMONSQUEEZY_WEBHOOK_SECRET
- LEMONSQUEEZY_STORE_ID
- LEMONSQUEEZY_VARIANT_ID
- NEXT_PUBLIC_CHECKOUT_URL (public hosted checkout URL, only if applicable to the eventual framework)

Do not deploy this as a working integration until the application framework and Lemon Squeezy product details are verified.
