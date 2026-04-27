# River Med

Full-stack clinic management system with three role-based portals: **Admin**, **Doctor**, and **Patient**.

| | |
|---|---|
| **Frontend** | React + Vite → Vercel (`river-med-app.vercel.app`) |
| **Backend** | Node.js/Express → Linode (`briya-api.duckdns.org`) |
| **Database** | MySQL 8 on Linode |
| **Real-time** | Socket.IO |

---

## Repository layout

```
river-med-app/
├── frontend/          # React SPA (see frontend/README.md)
├── backend/           # Express API (see backend/README.md)
├── deploy/
│   └── deploy-backend.sh   # Server-side deploy script (called by CI)
├── ecosystem.config.cjs    # PM2 process definition
└── .github/
    └── workflows/
        └── deploy-backend.yml  # GitHub Actions — auto-deploy on push to main
```

---

## Live URLs

| Service | URL |
|---|---|
| Frontend (Vercel) | `https://river-med-app.vercel.app` |
| Backend API | `https://briya-api.duckdns.org/api/river` |
| Health check | `https://briya-api.duckdns.org/api/river/health` |

---

## CI/CD — automatic deployment

Every push to `main` that touches `backend/**` triggers the **Deploy Backend → Linode** GitHub Actions workflow.

### What the workflow does
1. SSHes into the Linode server using the `LINODE_SSH_KEY` secret
2. Runs `deploy/deploy-backend.sh` which:
   - Pulls the latest code (`git reset --hard origin/main`)
   - Installs dependencies (`npm ci --omit=dev`)
   - Runs database migrations (`mysql < backend/src/db/migrate.sql`)
   - Reloads PM2 (`pm2 reload river-med-backend --update-env`)
   - Polls the health endpoint until it returns 200

The frontend deploys automatically via Vercel's GitHub integration on every push (no workflow needed).

### Required GitHub secrets

Go to **Repo → Settings → Secrets and variables → Actions** and set:

| Secret | Value |
|---|---|
| `LINODE_HOST` | Linode server IP (`50.116.47.133`) |
| `LINODE_USER` | `briya` |
| `LINODE_SSH_KEY` | Private SSH key (passphrase-protected, full PEM block) |
| `LINODE_SSH_PASSPHRASE` | SSH key passphrase |
| `LINODE_PORT` | `22` |

---

## Manual backend deployment

If you need to deploy without GitHub Actions:

```bash
# SSH into the server
ssh briya@50.116.47.133

# Run the deploy script
cd ~/projects/river_med
bash deploy/deploy-backend.sh
```

---

## Server setup (Linode)

| Item | Value |
|---|---|
| OS | Ubuntu 22.04 |
| Server IP | `50.116.47.133` |
| SSH user | `briya` |
| Project path | `/home/briya/projects/river_med` |
| Node process | PM2 — `river-med-backend` (id 2) |
| API port | `4001` (internal) |
| Reverse proxy | Nginx → DuckDNS domain |
| Domain | `briya-api.duckdns.org` |
| SSL | Let's Encrypt via Certbot |

### Useful server commands

```bash
# Process status
pm2 status

# Live logs
pm2 logs river-med-backend

# Restart after manual changes
pm2 restart river-med-backend

# Check Nginx
sudo systemctl status nginx
sudo systemctl reload nginx

# Renew SSL cert
sudo certbot renew
sudo systemctl reload nginx

# MySQL
mysql -u briya -p river_med
```

---

## Local development

### Prerequisites
- Node.js 18+
- MySQL 8
- A `river_med` database with the base schema loaded

### Backend

```bash
cd backend
cp .env.example .env     # set DB_*, JWT_SECRET, RESEND_API_KEY
npm install
node src/server.js       # runs on :4001
```

### Frontend

```bash
cd frontend
npm install
npm run dev              # runs on :5173, proxies /api → :4001
```

Open `http://localhost:5173`.

---

## Database migrations

The file `backend/src/db/migrate.sql` is **idempotent** — safe to run multiple times. It uses stored procedures and `CREATE TABLE IF NOT EXISTS` guards so re-running it on an existing database is a no-op for anything already applied.

Run manually:
```bash
mysql -u briya -p river_med < backend/src/db/migrate.sql
```

The deploy script runs this automatically on every deployment.

### Schema notes
- The original base tables (`users`, `patients`, `doctors`, `appointments`, etc.) use plain **`INT`** (signed) for primary keys.
- All Tier 1/2/3 tables that reference them use **`INT`** (not `INT UNSIGNED`) on FK columns to avoid MySQL 8 ERROR 3780.
- New tables that don't reference the base tables use `INT UNSIGNED AUTO_INCREMENT` for their own PKs.

---

## Environment files

| File | Location | Purpose |
|---|---|---|
| `backend/.env` | Server only — never committed | DB creds, JWT secret, Resend key |
| `backend/.env.production` | Server only — never committed | Production overrides |
| `frontend/.env.production` | Committed | `VITE_API_BASE` for Vercel build |

---

## Feature tiers

### Tier 1 — Core clinical workflow
- Patient profile editing (name, DOB, blood type, phone)
- Visit notes saved per appointment
- Vitals recording (weight, BP, heart rate, temperature, O2 sat)
- Medical history: allergies, conditions, current medications
- Admin user management (create, verify, activate/deactivate)

### Tier 2 — Extended features
- Doctor profile + weekly availability schedule
- Notification bell in all portals (polls every 60s)
- Patient document upload / download (PDF, images, Word — max 10 MB)
- Insurance information on patient profile
- Prescription print (styled popup)
- Doctor patient search

### Tier 3 — Billing, compliance, clinical tools
- Invoice management with line items (admin creates, patient views)
- Lab results (doctor records, patient views)
- Specialist referrals with status tracking
- CSV exports: appointments, patients, prescriptions, revenue
- Audit log (admin only, paginated with action filter)
