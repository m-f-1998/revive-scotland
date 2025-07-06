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

| Variable              | Description                         |
|-----------------------|-------------------------------------|
| `RECAPTCHA_SECRET_KEY` | Your Google reCAPTCHA v2/3 secret key for form verification |
| `SMTP_HOST`           | SMTP server hostname (e.g., `smtp.gmail.com`) |
| `SMTP_USER`           | SMTP login username (usually your email address) |
| `SMTP_PASS`           | SMTP login password or app-specific password |
| `SMTP_PORT`           | SMTP server port (typically `465` for SSL or `587` for TLS) |
| `EVENTBRITE_OAUTH_TOKEN` | OAuth 2.0 Token from Eventbrite to pull events |

## 📁 Example `.env` (for local dev)

```env
RECAPTCHA_SECRET_KEY=your-secret-key
SMTP_HOST=smtp.example.com
SMTP_USER=your@email.com
SMTP_PASS=yourpassword
SMTP_PORT=465
EVENTBRITE_OAUTH_TOKEN=token