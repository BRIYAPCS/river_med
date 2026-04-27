# River Med — Backend API

Node.js/Express REST API for the River Med clinic management system.

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express 4 |
| Database | MySQL 8 |
| Auth | JWT (jsonwebtoken) |
| Email | Resend (`noreply@innova-tech-solution.com`) |
| File uploads | Multer (disk storage → `backend/uploads/`) |
| Process manager | PM2 (`river-med-backend`) |
| Reverse proxy | Nginx |

---

## Local development

```bash
cd backend
cp .env.example .env          # fill in DB credentials, JWT_SECRET, etc.
npm install
node src/server.js            # or: npm run dev (if nodemon configured)
```

Server starts on `http://localhost:4001`.

---

## Environment variables (`.env`)

| Variable | Description |
|---|---|
| `PORT` | Server port (default `4001`) |
| `DB_HOST` | MySQL host (usually `localhost`) |
| `DB_USER` | MySQL user |
| `DB_PASSWORD` | MySQL password |
| `DB_NAME` | Database name (`river_med`) |
| `JWT_SECRET` | Secret key for signing JWTs |
| `RESEND_API_KEY` | Resend API key for email delivery |
| `EMAIL_FROM` | Sender address (e.g. `"River Med <noreply@innova-tech-solution.com>"`) |

---

## API base

| Environment | URL |
|---|---|
| Development | `http://localhost:4001/api` |
| Production | `https://briya-api.duckdns.org/api/river` |

All routes are prefixed with `/api`.

---

## Authentication

JWT Bearer token — include in every protected request:

```
Authorization: Bearer <token>
```

Token lifetime is set in `authController.js`. The middleware also accepts `?token=<jwt>` as a query parameter for file downloads (documents, CSV exports).

**Roles:** `admin` | `doctor` | `patient`

---

## Route map

### Auth — `/api/auth`
| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/login` | Public | Email or phone + password login |
| POST | `/request-otp` | Public | Send OTP via email/SMS |
| POST | `/verify-otp` | Public | Verify OTP code |
| POST | `/patient/register` | Public | New patient self-registration |
| POST | `/forgot-password` | Public | Send password reset link |
| POST | `/reset-password` | Public | Reset password with token |
| GET | `/me` | Auth | Current user profile (fresh DB query) |

### Patients — `/api/patients`
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/` | Auth | List all patients |
| GET | `/me` | Patient | Own patient record (lazy-link if needed) |
| GET | `/:id` | Auth | Get patient by ID |
| POST | `/` | Auth | Create patient |
| PUT | `/me` | Patient | Update own profile (name, phone, DOB, blood type) |

### Doctors — `/api/doctors`
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/` | Public | List all doctors |
| GET | `/me` | Doctor | Own doctor profile |
| PUT | `/me` | Doctor | Update own profile (name, specialty, phone) |
| GET | `/me/availability` | Doctor | Own weekly schedule |
| PUT | `/me/availability` | Doctor | Replace weekly schedule |
| GET | `/:id/availability` | Public | Doctor's public availability |
| POST | `/` | Auth | Create doctor record |

### Appointments — `/api/appointments`
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/` | Auth | All appointments |
| GET | `/me` | Auth | Role-aware: own appointments |
| GET | `/today` | Auth | Today's appointments |
| GET | `/patient/:id` | Auth | Patient's appointments |
| POST | `/` | Auth | Book appointment (double-booking guard) |
| PUT | `/:id/status` | Auth | Update status |
| PUT | `/:id/assign` | Admin | Assign doctor |
| PUT | `/:id/notes` | Doctor | Save visit notes |
| DELETE | `/:id` | Auth | Cancel (patient: soft) / delete (admin: hard) |

### Prescriptions — `/api/prescriptions`
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/me` | Auth | Role-aware: own prescriptions |
| GET | `/:patientId` | Auth | Patient's prescriptions |
| POST | `/` | Doctor | Write prescription |
| POST | `/:id/refill` | Patient | Request refill |

### Refill Requests — `/api/refill_requests`
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/me` | Auth | Role-aware refill requests |
| GET | `/pending` | Doctor/Admin | All pending refills |
| GET | `/patient/:id` | Auth | Patient's refill requests |
| POST | `/` | Patient | Create refill request |
| PUT | `/:id/status` | Doctor/Admin | Approve / deny |

### Messages — `/api/messages`
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/threads` | Auth | Role-aware thread list with unread count |
| GET | `/thread/:patientId/:doctorId` | Auth | Full thread history |
| POST | `/` | Auth | Send message |
| GET | `/` | Admin | All messages |
| PUT | `/:id/read` | Auth | Mark message as read |

### Medical History — `/api/medical`
| Method | Path | Access | Description |
|---|---|---|---|
| GET/POST | `/allergies` | Auth | List / add allergies |
| PUT/DELETE | `/allergies/:id` | Auth | Update / remove allergy |
| GET/POST | `/conditions` | Auth | List / add conditions |
| PUT/DELETE | `/conditions/:id` | Auth | Update / remove condition |
| GET/POST | `/medications` | Auth | List / add current medications |
| PUT/DELETE | `/medications/:id` | Auth | Update / remove medication |

### Vitals — `/api/appointments/:id/vitals`
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/` | Auth | Get vitals for appointment |
| POST | `/` | Doctor/Admin | Record vitals (upsert) |

### Notifications — `/api/notifications`
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/` | Auth | Own notifications |
| PUT | `/:id/read` | Auth | Mark one as read |
| PUT | `/read-all` | Auth | Mark all as read |

### Insurance — `/api/insurance`
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/` | Auth | Patient insurance record |
| PUT | `/` | Auth | Create or update insurance (upsert) |

### Documents — `/api/documents`
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/` | Auth | List documents (`?patient_id=X`) |
| POST | `/` | Auth | Upload file (multipart, max 10 MB) |
| GET | `/:id/download` | Auth | Download file (supports `?token=`) |
| DELETE | `/:id` | Auth | Delete document + file |

**Allowed types:** PDF, JPG, PNG, WEBP, DOC, DOCX

### Invoices — `/api/invoices`
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/` | Admin/Patient | List invoices (role-filtered) |
| POST | `/` | Admin | Create invoice with line items |
| PUT | `/:id` | Admin | Update status / line items |
| DELETE | `/:id` | Admin | Delete (not if paid) |

### Lab Results — `/api/lab_results`
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/` | Auth | Role-aware lab results |
| POST | `/` | Doctor/Admin | Add lab result |
| PUT | `/:id` | Doctor/Admin | Update result / status |
| DELETE | `/:id` | Doctor/Admin | Delete |

### Referrals — `/api/referrals`
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/` | Auth | Role-aware referrals |
| POST | `/` | Doctor/Admin | Create referral |
| PUT | `/:id/status` | Doctor/Admin | Update status |

### Reports — `/api/reports` (Admin only, CSV download)
| Method | Path | Description |
|---|---|---|
| GET | `/appointments` | All appointments CSV |
| GET | `/patients` | Patient roster CSV |
| GET | `/prescriptions` | Prescriptions CSV |
| GET | `/revenue` | Monthly revenue from invoices CSV |

### Audit Log — `/api/audit_log` (Admin only)
| Method | Path | Description |
|---|---|---|
| GET | `/` | Paginated audit events (`?action=&entity_type=&limit=&offset=`) |

### Admin — `/api/admin`
| Method | Path | Description |
|---|---|---|
| GET | `/users` | All users with patient/doctor names |
| POST | `/users` | Create staff account |
| PUT | `/users/:id` | Update user |
| PUT | `/users/:id/status` | Toggle active/inactive |
| PUT | `/users/:id/verify` | Manually verify account |

### Analytics — `/api/analytics`
| Method | Path | Description |
|---|---|---|
| GET | `/` | Summary stats |
| GET | `/appointments-per-day` | Daily appointment counts |
| GET | `/top-medications` | Most prescribed medications |
| GET | `/doctor-load` | Appointment count per doctor |

### Health — `/api/health`
```json
{ "status": "ok", "uptime": 42, "timestamp": "...", "database": "connected" }
```

---

## Database schema (key tables)

| Table | Description |
|---|---|
| `users` | Accounts for all roles |
| `patients` | Patient profiles |
| `doctors` | Doctor profiles |
| `appointments` | Appointment records |
| `prescriptions` | Prescriptions written by doctors |
| `refill_requests` | Patient refill requests |
| `messages` | Patient–doctor messages |
| `otp_codes` | Hashed OTP codes |
| `password_reset_tokens` | Password reset flow |
| `patient_allergies` | Allergy records |
| `patient_conditions` | Medical conditions |
| `patient_medications` | Current medications |
| `appointment_vitals` | Vitals per appointment (one row) |
| `doctor_availability` | Weekly schedule per doctor |
| `notifications` | In-app notifications |
| `patient_insurance` | Insurance info (one row per patient) |
| `documents` | Uploaded files metadata |
| `invoices` | Billing invoices with JSON line items |
| `lab_results` | Lab test results |
| `referrals` | Specialist referrals |
| `audit_log` | Action log for compliance |

---

## File uploads

Files are stored in `backend/uploads/` on disk. The path is recorded in the `documents.storage_path` column. On the production server this directory is at `/home/briya/projects/river_med/backend/uploads/`.

**Important:** This directory is not in git. On a fresh server deployment, PM2 / the app creates it automatically on first upload.

---

## OTP / Email

- OTP codes are **always printed to PM2 logs** as a fallback, regardless of email delivery status.
- Email is sent via **Resend** using the verified domain `innova-tech-solution.com`.
- If `RESEND_API_KEY` is missing, only the PM2 log fallback is used.

---

## PM2

```bash
pm2 status                         # check status
pm2 logs river-med-backend         # tail logs
pm2 restart river-med-backend      # restart
pm2 reload river-med-backend --update-env  # reload with new env vars
```

The process name is `river-med-backend` (id 2 in the current setup).
