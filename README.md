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

The backend server requires the following environment variables to function properly:

| Variable                   | Description                                                        |
|----------------------------|--------------------------------------------------------------------|
| `RECAPTCHA_SITE`                | Google reCAPTCHA site key for client-side verification             |
| `RECAPTCHA_API_KEY`             | Google reCAPTCHA API key for server-side requests                  |
| `PUBLIC_DOMAIN`                 | Public domain for the application (e.g., `http://localhost:3000`)  |
| `R2_ACCESS_KEY_ID`              | Cloudflare R2 access key ID for file uploads                       |
| `R2_SECRET_ACCESS_KEY`          | Cloudflare R2 secret access key for file uploads                   |
| `R2_ACCOUNT_ID`                 | Cloudflare R2 account ID                                           |
| `R2_BUCKET_NAME`                | Cloudflare R2 bucket name                                          |
| `FIREBASE_API_KEY`              | Firebase API key                                                   |
| `FIREBASE_AUTH_DOMAIN`          | Firebase authentication domain                                     |
| `FIREBASE_PROJECT_ID`           | Firebase project ID                                                |
| `FIREBASE_STORAGE_BUCKET`       | Firebase storage bucket                                            |
| `FIREBASE_MESSAGING_SENDER_ID`  | Firebase messaging sender ID                                       |
| `FIREBASE_APP_ID`               | Firebase app ID                                                    |
| `FIREBASE_MEASUREMENT_ID`       | Firebase measurement ID                                            |
| `FIREBASE_CLIENT_EMAIL`         | Firebase client email for admin SDK                                |
| `STRIPE_SECRET_KEY`             | Secret Key for Stripe Privileged Access                            |
| `STRIPE_WEBHOOK_SECRET`         | Webhook signing secret for Checkout / Invoice events               |

## 📁 Example `.env` (for local dev)

```env
RECAPTCHA_SITE=
RECAPTCHA_API_KEY=
PUBLIC_DOMAIN=

R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_ACCOUNT_ID=
R2_BUCKET_NAME=

FIREBASE_API_KEY=
FIREBASE_AUTH_DOMAIN=
FIREBASE_PROJECT_ID=
FIREBASE_STORAGE_BUCKET=
FIREBASE_MESSAGING_SENDER_ID=
FIREBASE_APP_ID=
FIREBASE_MEASUREMENT_ID=
FIREBASE_CLIENT_EMAIL=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

## ✉️ Stripe customer emails (no SMTP)

Payment and donation emails are sent by **Stripe**, not by this app. There is no SMTP configuration.

### Enable payment receipts (confirmation after paying)

1. Open the [Stripe Dashboard → Settings → Customer emails](https://dashboard.stripe.com/settings/emails).
2. Under **Payments**, turn on **Successful payments** (and optionally **Refunds**).
3. Confirm your public business details and branding under [Settings → Business](https://dashboard.stripe.com/settings/public) so receipts look correct.

Checkout sessions also set `receipt_email` from the registrant’s address when available.

### How emails are used for event registrations

| Scenario | What happens |
|----------|----------------|
| **Optional donation**, registrant does not pay now | Registration is saved as completed. Stripe emails an **invoice** with a pay link so they can donate later. |
| **Optional donation**, registrant opts in | Details are held in a temporary checkout draft only. Stripe Checkout runs; on success the registration is written. Cancel / abandon → Stripe emails an **invoice** pay link; registration is created when that invoice is paid. |
| **Required donation** | Same as opted-in optional: no registration until payment succeeds. Cancel / abandon → Stripe emails a pay-link invoice. |
| **Paid successfully** | Stripe payment receipt is the confirmation email. |

Abandoned Checkout: the draft is kept and Stripe emails an invoice pay link. When the invoice is paid, the registration is created. Ensure Customer emails / unpaid invoice reminders are enabled in the Stripe Dashboard.

### Unpaid invoice reminders (optional donate-later only)

1. Open [Stripe Dashboard → Settings → Customer emails](https://dashboard.stripe.com/settings/emails) (and Billing email settings if prompted).
2. Enable reminders for **unpaid invoices** if you use optional donate-later invoices.
3. Ensure the webhook endpoint includes at least:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `invoice.paid` (or `invoice.payment_succeeded`)

Local webhook testing: `stripe listen --forward-to localhost:3000/api/events/stripe/webhook`
