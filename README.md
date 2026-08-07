# revivescotland.co.uk 🌐
Website design for [Revive Scotland](https://revivescotland.co.uk) — built using Angular and Node.js, containerized with Docker.

## 🌱 Features
- Modern Angular frontend
- TypeScript backend (Node.js)
- Built and deployed with GitHub Actions
- Dev and Production branches
- Image hosted on GHCR

## 🚀 Deployment

Images are published to:
- `ghcr.io/m-f-1998/revive-scotland:dev` – Dev (`beta.*`)
- `ghcr.io/m-f-1998/revive-scotland:latest` – Production

## 🐳 Local Development

```bash
./dev.sh # Docker Compose Local Development Server on Port 3000
./deploy.sh ${dev|latest} # Deploy Package (Requires GHCR Access Token)
```

## 🔧 Required Environment Variables

Boot fails in production if required vars are missing. `DEV_MODE=true` is **opt-in only** and must never be set when `NODE_ENV=production`.

| Variable | Required | Description |
|----------|----------|-------------|
| `RECAPTCHA_SITE` / `RECAPTCHA_API_KEY` | Yes | reCAPTCHA Enterprise. `RECAPTCHA_SITE` is injected into the SPA so browser + server match Portainer |
| `RECAPTCHA_PROJECT_ID` | Optional | GCP project for assessments (default `revive-scotland`) |
| `RECAPTCHA_MIN_SCORE` | Optional | Minimum Enterprise score `0`–`1` (default `0.5` in all environments, including pre-prod) |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME` | Yes | Cloudflare R2 |
| `SUPERADMIN_EMAIL` | Yes | Primary admin (also used for Firebase custom claims) |
| `ADMIN_EMAIL` / `ADMIN_EMAILS` | Recommended | Extra admin allowlist (comma-separated for `ADMIN_EMAILS`) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS` | Prod | Firebase Admin credentials (do **not** bake JSON into Docker images) |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Payments | Stripe; webhook secret required outside DEV_MODE |
| `RESEND_API_KEY` | Recommended | [Resend](https://resend.com) API key for staff alerts and registrant confirmation emails (free tier: 3,000/month) |
| `EMAIL_FROM` | With Resend | Sender address, e.g. `Revive Scotland <hello@revivescotland.co.uk>` — verify your domain in Resend for production |
| `PUBLIC_DOMAIN` | Recommended | Public origin for share/Stripe URLs |
| `CORS_ORIGINS` | Recommended | Comma-separated allowed origins |
| `TRUST_PROXY` | Behind CDN | Hop count (`1`) or CIDR list; defaults to loopback only. Set `1` behind Cloudflare/Traefik so `req.ip` (and reCAPTCHA assessments) see the real client IP |
| `DEV_MODE` | Local only | `true`/`1` enables local bypasses (reCAPTCHA/webhook mock). **Rejected at boot** if `NODE_ENV=production`. |
| `PRE_PROD` | Staging | Use **dev** Firebase for Auth (`revive-scotland-firebase-dev.json`) |
| `GA_SERVICE_ACCOUNT_JSON` / `GA_GOOGLE_APPLICATION_CREDENTIALS` | Pre-prod / optional | **Prod** SA for dashboard GA (property access is on prod, not the Auth project) |
| `CF_BEACON_TOKEN` / `GA_TRACKING_ID` | Optional | Analytics injection |

## 📁 Example `.env` (for local dev)

```env
DEV_MODE=true
RECAPTCHA_SITE=
RECAPTCHA_API_KEY=
PUBLIC_DOMAIN=http://localhost:3000
CORS_ORIGINS=http://localhost:4200,http://localhost:3000

R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_ACCOUNT_ID=
R2_BUCKET_NAME=

SUPERADMIN_EMAIL=you@example.com
ADMIN_EMAILS=

# Prefer a mounted file or JSON env in deployed environments:
# GOOGLE_APPLICATION_CREDENTIALS=/secrets/firebase.json
# FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Email notifications via Resend (https://resend.com — free tier)
RESEND_API_KEY=
EMAIL_FROM=Revive Scotland <onboarding@resend.dev>
```

## ✉️ Email notifications (Resend)

Staff alerts and registrant confirmation emails are sent via **[Resend](https://resend.com)** (free tier). There is no Slack/Discord webhook and no SMTP configuration.

### Staff inbox routing

Staff notification emails (contact form, new registrations) are routed by environment — **not** by `SUPERADMIN_EMAIL`:

| Environment | Inbox |
|-------------|-------|
| Production | `luca@revivescotland.co.uk` |
| Dev (`DEV_MODE=true`), pre-prod (`PRE_PROD=true`), or `PUBLIC_DOMAIN` containing `dev.revivescotland.co.uk` | `admin@matthewfrankland.co.uk` |

`SUPERADMIN_EMAIL` is always `admin@matthewfrankland.co.uk` and is used only for Firebase admin authentication, not for notification delivery.

### Setup

1. Create a free [Resend](https://resend.com) account and generate an API key → set `RESEND_API_KEY`.
2. For local testing, use the default `EMAIL_FROM=Revive Scotland <onboarding@resend.dev>`.
3. For production, verify `revivescotland.co.uk` in Resend (DNS records) and set e.g. `EMAIL_FROM=Revive Scotland <hello@revivescotland.co.uk>`.
4. Keep `SUPERADMIN_EMAIL=admin@matthewfrankland.co.uk` for Firebase admin auth (all environments). Notification routing is automatic by environment.

### What gets emailed

| Event | Staff email | Registrant email |
|-------|-------------|------------------|
| Contact form submitted | Branded HTML alert | — |
| New registration (free, waitlist, or paid) | Single **New Registration** alert — payment details included only when money was taken | Confirmation with event details |
| Optional donation completed later | **Payment received** alert with amount | **Payment received** follow-up with event details and amount |

## ✉️ Stripe payment receipts

### Enable payment receipts (confirmation after paying)

1. Open the [Stripe Dashboard → Settings → Customer emails](https://dashboard.stripe.com/settings/emails).
2. Under **Payments**, turn on **Successful payments** (and optionally **Refunds**).
3. Confirm your public business details and branding under [Settings → Business](https://dashboard.stripe.com/settings/public) so receipts look correct.

Checkout sessions also set `receipt_email` from the registrant’s address when available.

### How emails are used for event registrations

| Scenario | What happens |
|----------|----------------|
| **Optional donation**, registrant does not pay now | Registration saved; app sends staff + registrant confirmation emails. |
| **Optional donation**, registrant opts in | Registration is saved immediately (staff + registrant confirmation emails), then Stripe Checkout runs for the donation. Cancel / abandon → registration stays confirmed; a resume pay link is offered and **payment received** is emailed when they pay later. |
| **Required donation** | Same as opted-in optional: no registration until payment succeeds. |
| **Optional donation**, registrant opts in then cancels / pays later | Registration already confirmed; on payment the app sends a **payment received** alert to staff and a matching follow-up to the registrant. |
| **Paid successfully** (first-time registration) | App sends staff **New Registration** alert (with payment amount) + registrant confirmation; Stripe also sends a payment receipt. |

Abandoned Checkout: the draft is kept and Stripe emails an invoice pay link. When the invoice is paid, the registration is created. Ensure Customer emails / unpaid invoice reminders are enabled in the Stripe Dashboard.

### Unpaid invoice reminders (optional donate-later only)

1. Open [Stripe Dashboard → Settings → Customer emails](https://dashboard.stripe.com/settings/emails) (and Billing email settings if prompted).
2. Enable reminders for **unpaid invoices** if you use optional donate-later invoices.
3. Ensure the webhook endpoint includes at least:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `invoice.paid` (or `invoice.payment_succeeded`)

Local webhook testing: `stripe listen --forward-to localhost:3000/api/events/stripe/webhook`

### General (home page) donations

The home **Donate Now** button uses a **Stripe Payment Link** hardcoded in `DonateComponent` (test vs live URLs). It is **not** created by the app Checkout/webhook pipeline.

In the [Stripe Dashboard → Payment Links](https://dashboard.stripe.com/payment-links):

1. Open the live donate link.
2. Set **After payment → Redirect to** `https://revivescotland.co.uk/donate/thank-you` (and the test link to your staging thank-you URL if needed).
3. Prefer a clear product name such as **General Donation** so the admin donations view and Stripe reports can filter it.

Event registration payments use Checkout Sessions + webhooks and appear against each event’s Stripe product. General Payment Link donations may only show in the admin donations list when Stripe also creates a Checkout Session for that link.
