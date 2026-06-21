# Expense Portal

Employee expense-upload portal for Chesa Dental Care — a mobile-first **PWA** where concern persons log in with **mobile + OTP**, upload expenses (with bill image/PDF), and track approval status.

## Stack
- **React 19 + TypeScript + Vite**, Tailwind CSS v4
- **PWA** (installable, offline shell, auto-update) via `vite-plugin-pwa`
- Client-side **image compression** before upload (prevents OOM on large photos)
- PDF statement export (`jspdf` + `html2canvas`)

## Develop
```bash
npm install
npm run dev      # http://localhost:5174
```

## Build
```bash
npm run build    # → dist/ (static, includes .htaccess for SPA routing + service worker)
```

## API config
- Main API (`VITE_API_URL`): `.env.development` / `.env.production` → `https://api.chesadentalcare.com`.
- **OTP** server is independent and always prod (`https://apis.chesadentalcare.com`), hardcoded in `src/api/client.ts`.

## Deploy
Served by Apache at **expense.chesadentalcare.com** (HTTPS via the AWS ALB wildcard cert).

- **CI/CD:** push to `main` → GitHub Actions builds and deploys to the EC2 (`.github/workflows/deploy.yml`). Requires repo secrets `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`.
- **Manual:** `bash deploy.sh` (build + ship `dist/` + backup/rollback + verify). Config in `deploy.config.sh` (copy from `deploy.config.example.sh`).
