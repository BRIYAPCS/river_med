# River Med — Frontend

React SPA for the River Med clinic management system. Three role-based portals — Admin, Doctor, and Patient — served from a single Vite build.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | React 18 |
| Build tool | Vite |
| Styling | Tailwind CSS v4 |
| Routing | React Router v6 |
| Real-time | Socket.IO client |
| HTTP | Native `fetch` (custom wrapper in `src/services/api.js`) |
| Deployment | Vercel |

---

## Local development

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

The Vite dev server proxies `/api` → `http://localhost:4001` (see `vite.config.js`).

```bash
npm run build      # production build → dist/
npm run preview    # preview production build locally
```

---

## Environment variables

| Variable | Description |
|---|---|
| `VITE_API_BASE` | API base URL. Empty in dev (proxy used). Set in `.env.production` for prod. |

**`.env.production`**
```
VITE_API_BASE=https://briya-api.duckdns.org/api/river
```

---

## Project structure

```
src/
├── App.jsx                  # Route tree — all portals and public pages
├── main.jsx                 # App entry point, AuthProvider
├── context/
│   └── AuthContext.jsx      # JWT decode, login/logout, user state
├── components/
│   ├── ProtectedRoute.jsx   # Role-gated wrapper for React Router
│   └── NotificationBell.jsx # Shared bell component (polls every 60s)
├── layouts/
│   ├── AdminLayout.jsx      # Admin sidebar + header
│   ├── DoctorLayout.jsx     # Doctor sidebar + header
│   └── PatientLayout.jsx    # Patient sidebar + bottom nav (mobile)
├── pages/
│   ├── auth/                # Login, Register, ForgotPassword, ResetPassword
│   ├── admin/               # Dashboard, Queue, Appointments, Patients,
│   │                        # Billing, Analytics, Reports, AuditLog
│   ├── doctor/              # Dashboard, Appointments, Prescriptions,
│   │                        # Refills, PatientSearch, Profile, VisitPanel
│   ├── patient/             # Dashboard, Appointments, Prescriptions,
│   │                        # Profile, Documents, Invoices
│   ├── shared/              # MedicalHistory, LabResults, Referrals, ChatPage
│   └── calendar/            # CalendarPage (admin)
└── services/
    └── api.js               # All API calls, token management
```

---

## Portals and routes

### Public
| Path | Page |
|---|---|
| `/` | Landing page |
| `/login` | Login (email or phone, OTP or password) |
| `/register` | Patient self-registration |
| `/forgot-password` | Password reset request |
| `/reset-password` | Password reset with token |

### Admin portal — `/admin` (role: `admin`)
| Path | Page |
|---|---|
| `/admin` | Dashboard |
| `/admin/queue` | Appointment queue |
| `/admin/refills` | Refill requests |
| `/admin/patients` | Patients + Users management |
| `/admin/appointments` | All appointments |
| `/admin/billing` | Invoice management |
| `/admin/analytics` | Charts and stats |
| `/admin/reports` | CSV exports |
| `/admin/audit` | Audit log |
| `/admin/calendar` | Calendar view |

### Doctor portal — `/doctor` (role: `doctor`)
| Path | Page |
|---|---|
| `/doctor` | My Patients dashboard |
| `/doctor/appointments` | My appointments |
| `/doctor/prescriptions` | Write and view prescriptions (with print) |
| `/doctor/refills` | Refill queue |
| `/doctor/labs` | Lab results |
| `/doctor/referrals` | Referrals |
| `/doctor/search` | Find patient by name/email/phone |
| `/doctor/messages` | Patient messaging |
| `/doctor/profile` | Profile + weekly availability schedule |

### Patient portal — `/patient` (role: `patient`)
| Path | Page |
|---|---|
| `/patient` | Dashboard |
| `/patient/appointments` | My appointments |
| `/patient/prescriptions` | My prescriptions + refill requests |
| `/patient/history` | Medical history (allergies, conditions, medications) |
| `/patient/labs` | Lab results |
| `/patient/referrals` | Referrals |
| `/patient/documents` | Document upload and download |
| `/patient/invoices` | Billing history (with print) |
| `/patient/messages` | Message my doctor |
| `/patient/profile` | Profile + insurance |

---

## Authentication flow

1. User logs in → server returns JWT
2. Token stored in `localStorage` as `river_med_token`
3. `AuthContext` decodes the JWT client-side for `user.role`, `user.patient_id`, etc.
4. `ProtectedRoute` checks `user.role` before rendering any portal route
5. On 401 response, `api.js` fires `window.dispatchEvent(new CustomEvent('auth:expired'))` — `AuthContext` catches this and calls `logout()`
6. `logout()` clears `localStorage` and redirects to `/login`

**JWT payload fields:** `id`, `email`, `phone`, `role`, `patient_id`, `doctor_id`, `first_name`, `last_name`, `full_name`, `is_verified`

---

## API service (`src/services/api.js`)

Single source of truth for all HTTP calls. Every function calls the internal `request(method, path, body)` helper which:

- Prepends `VITE_API_BASE` (or `/api` in dev)
- Attaches `Authorization: Bearer <token>` header
- Parses JSON response
- Throws on non-2xx with the server's error message
- Fires `auth:expired` event on 401

**File uploads** use raw `fetch` with `FormData` (no `Content-Type` header — browser sets multipart boundary automatically).

**CSV / file downloads** use `?token=<jwt>` query param since `<a href>` cannot set custom headers.

---

## Notification bell

`NotificationBell` is a shared component imported by all three layouts. It:

- Polls `GET /api/notifications` every 60 seconds
- Shows a red dot badge when there are unread notifications
- Calls `PUT /api/notifications/read-all` when the dropdown is opened
- Closes on outside click

---

## Login page features

- Auto-detects input mode: email vs. phone number
- Country code selector (24 countries, defaults to `+503` El Salvador)
- IP-based country auto-detection via Cloudflare trace endpoint
- Digit-count validation per country code
- OTP tab + Password tab
- "Resend verification" button shown when account is unverified
- Autocomplete attributes set correctly for password managers

---

## Vercel configuration

`frontend/vercel.json` contains the SPA rewrite rule that prevents 404 on page refresh:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

**Vercel project settings:**
- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `VITE_API_BASE` (set in Vercel dashboard)
