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
| `RECAPTCHA_SITE`           | Google reCAPTCHA site key for client-side verification             |
| `RECAPTCHA_API_KEY`        | Google reCAPTCHA API key for server-side requests                  |
| `PUBLIC_DOMAIN`            | Public domain for the application (e.g., `http://localhost:3000`)  |
| `SMTP_HOST`                | SMTP server hostname (e.g., `smtp.mail.me.com`)                    |
| `SMTP_USER`                | SMTP login username (usually your email address)                   |
| `SMTP_DESTINATION`         | Destination email address for contact forms                        |
| `SMTP_PASS`                | SMTP login password or app-specific password                       |
| `SMTP_PORT`                | SMTP server port (typically `465` for SSL or `587` for TLS)        |
| `R2_ACCESS_KEY_ID`         | Cloudflare R2 access key ID for file uploads                       |
| `R2_SECRET_ACCESS_KEY`     | Cloudflare R2 secret access key for file uploads                   |
| `R2_ACCOUNT_ID`            | Cloudflare R2 account ID                                           |
| `R2_BUCKET_NAME`           | Cloudflare R2 bucket name                                          |
| `FIREBASE_API_KEY`         | Firebase API key                                                   |
| `FIREBASE_AUTH_DOMAIN`     | Firebase authentication domain                                     |
| `FIREBASE_PROJECT_ID`      | Firebase project ID                                                |
| `FIREBASE_STORAGE_BUCKET`  | Firebase storage bucket                                            |
| `FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID                                 |
| `FIREBASE_APP_ID`          | Firebase app ID                                                    |
| `FIREBASE_MEASUREMENT_ID`  | Firebase measurement ID                                            |
| `FIREBASE_CLIENT_EMAIL`    | Firebase client email for admin SDK                                |

## 📁 Example `.env` (for local dev)

```env
RECAPTCHA_SITE=
RECAPTCHA_API_KEY=
PUBLIC_DOMAIN=

SMTP_HOST=
SMTP_USER=
SMTP_DESTINATION=
SMTP_PASS=
SMTP_PORT=465

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
```