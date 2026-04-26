// Dev:  VITE_API_BASE is empty → Vite proxy forwards /api → http://localhost:4000
// Prod: VITE_API_BASE=https://briya-api.duckdns.org/api/river (set in .env.production)
const API_BASE = import.meta.env.VITE_API_BASE || '/api'

// ─── auth token helper ────────────────────────────────────────────────────────

function getToken() {
  return localStorage.getItem('river_med_token')
}

// ─── core request ─────────────────────────────────────────────────────────────

async function request(method, path, body) {
  const url   = `${API_BASE}${path}`
  const token = getToken()

  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (token) options.headers['Authorization'] = `Bearer ${token}`
  if (body !== undefined) options.body = JSON.stringify(body)

  console.log(`[API] ${method} ${url}`, body ?? '')

  let res
  try {
    res = await fetch(url, options)
  } catch (networkErr) {
    // fetch itself threw — server unreachable, no internet, CORS preflight blocked, etc.
    console.error(`[API] Network error on ${method} ${url}:`, networkErr.message)
    throw new Error(`Cannot reach the server (${url}). Check your connection or try again.`)
  }

  // try to parse JSON body regardless of status (backend often sends {error:"..."})
  let data
  try {
    data = await res.json()
  } catch {
    data = null
  }

  if (!res.ok) {
    const message =
      data?.error ||
      data?.message ||
      `${method} ${path} failed — ${res.status} ${res.statusText}`
    console.error(`[API] ${res.status} ${method} ${url}:`, message)
    throw new Error(message)
  }

  console.log(`[API] ${res.status} ${method} ${url} →`, data)
  return data
}

// ─── analytics ────────────────────────────────────────────────────────────────

export async function getAnalytics() {
  try {
    return await request('GET', '/analytics')
  } catch (err) {
    console.error('[API] getAnalytics failed:', err.message)
    throw err
  }
}

export async function getAppointmentsPerDay() {
  try {
    return await request('GET', '/analytics/appointments-per-day')
  } catch (err) {
    console.error('[API] getAppointmentsPerDay failed:', err.message)
    throw err
  }
}

export async function getTopMedications() {
  try {
    return await request('GET', '/analytics/top-medications')
  } catch (err) {
    console.error('[API] getTopMedications failed:', err.message)
    throw err
  }
}

export async function getDoctorLoad() {
  try {
    return await request('GET', '/analytics/doctor-load')
  } catch (err) {
    console.error('[API] getDoctorLoad failed:', err.message)
    throw err
  }
}

// ─── auth v2 — production role-based system ───────────────────────────────────

export async function registerPatient(data) {
  try {
    return await request('POST', '/auth/patient/register', data)
  } catch (err) {
    console.error('[API] registerPatient failed:', err.message)
    throw err
  }
}

export async function loginWithPassword(identifier, password) {
  try {
    return await request('POST', '/auth/login', { identifier, password })
  } catch (err) {
    console.error('[API] loginWithPassword failed:', err.message)
    throw err
  }
}

export async function requestOtp(identifier, purpose) {
  try {
    return await request('POST', '/auth/request-otp', { identifier, purpose })
  } catch (err) {
    console.error('[API] requestOtp failed:', err.message)
    throw err
  }
}

export async function verifyOtp(identifier, code, purpose) {
  try {
    return await request('POST', '/auth/verify-otp', { identifier, code, purpose })
  } catch (err) {
    console.error('[API] verifyOtp failed:', err.message)
    throw err
  }
}

// Accepts email only. Backend returns a generic message regardless of whether
// the account exists (prevents user enumeration).
export async function forgotPassword(email) {
  try {
    return await request('POST', '/auth/forgot-password', { email })
  } catch (err) {
    console.error('[API] forgotPassword failed:', err.message)
    throw err
  }
}

// Token-based reset — token comes from the ?token= query param in the reset link.
export async function resetPasswordWithToken(token, newPassword) {
  try {
    return await request('POST', '/auth/reset-password', { token, newPassword })
  } catch (err) {
    console.error('[API] resetPasswordWithToken failed:', err.message)
    throw err
  }
}

export async function adminCreateStaff(data) {
  try {
    return await request('POST', '/admin/users', data)
  } catch (err) {
    console.error('[API] adminCreateStaff failed:', err.message)
    throw err
  }
}

// ─── auth (legacy — kept for backward compatibility) ──────────────────────────

export async function authLogin(email, password) {
  try {
    return await request('POST', '/auth/login', { email, password })
  } catch (err) {
    console.error('[API] authLogin failed:', err.message)
    throw err
  }
}

export async function authRegister(email, password, role) {
  try {
    return await request('POST', '/auth/register', { email, password, role })
  } catch (err) {
    console.error('[API] authRegister failed:', err.message)
    throw err
  }
}

export async function authMe() {
  try {
    return await request('GET', '/auth/me')
  } catch (err) {
    console.error('[API] authMe failed:', err.message)
    throw err
  }
}

// ─── patients ─────────────────────────────────────────────────────────────────

export async function getPatients() {
  try {
    return await request('GET', '/patients')
  } catch (err) {
    console.error('[API] getPatients failed:', err.message)
    throw err
  }
}

export async function createPatient(data) {
  try {
    return await request('POST', '/patients', data)
  } catch (err) {
    console.error('[API] createPatient failed:', err.message)
    throw err
  }
}

// ─── appointments ─────────────────────────────────────────────────────────────

export async function getAppointments() {
  try {
    return await request('GET', '/appointments')
  } catch (err) {
    console.error('[API] getAppointments failed:', err.message)
    throw err
  }
}

export async function getTodayAppointments() {
  try {
    return await request('GET', '/appointments/today')
  } catch (err) {
    console.error('[API] getTodayAppointments failed:', err.message)
    throw err
  }
}

export async function updateAppointmentStatus(id, status) {
  if (!id)     throw new Error('updateAppointmentStatus: id is required')
  if (!status) throw new Error('updateAppointmentStatus: status is required')
  try {
    return await request('PUT', `/appointments/${id}/status`, { status })
  } catch (err) {
    console.error(`[API] updateAppointmentStatus(${id}, ${status}) failed:`, err.message)
    throw err
  }
}

export async function createAppointment(data) {
  try {
    return await request('POST', '/appointments', data)
  } catch (err) {
    console.error('[API] createAppointment failed:', err.message)
    throw err
  }
}

export async function updateAppointment(id, data) {
  if (!id) throw new Error('updateAppointment: id is required')
  try {
    return await request('PUT', `/appointments/${id}`, data)
  } catch (err) {
    console.error(`[API] updateAppointment(${id}) failed:`, err.message)
    throw err
  }
}

export async function deleteAppointment(id) {
  if (!id) throw new Error('deleteAppointment: id is required')
  try {
    return await request('DELETE', `/appointments/${id}`)
  } catch (err) {
    console.error(`[API] deleteAppointment(${id}) failed:`, err.message)
    throw err
  }
}

export async function getPatient(id) {
  if (!id) throw new Error('getPatient: id is required')
  try {
    return await request('GET', `/patients/${id}`)
  } catch (err) {
    console.error(`[API] getPatient(${id}) failed:`, err.message)
    throw err
  }
}

export async function getPatientAppointments(patientId) {
  if (!patientId) throw new Error('getPatientAppointments: patientId is required')
  try {
    return await request('GET', `/appointments/patient/${patientId}`)
  } catch (err) {
    console.error(`[API] getPatientAppointments(${patientId}) failed:`, err.message)
    throw err
  }
}

// ─── doctors ──────────────────────────────────────────────────────────────────

export async function getDoctors() {
  try {
    return await request('GET', '/doctors')
  } catch (err) {
    console.error('[API] getDoctors failed:', err.message)
    throw err
  }
}

// ─── messages ─────────────────────────────────────────────────────────────────

export async function getMessages() {
  try {
    return await request('GET', '/messages')
  } catch (err) {
    console.error('[API] getMessages failed:', err.message)
    throw err
  }
}

export async function getThreads() {
  try {
    return await request('GET', '/messages/threads')
  } catch (err) {
    console.error('[API] getThreads failed:', err.message)
    throw err
  }
}

export async function getThread(patientId, doctorId) {
  if (!patientId) throw new Error('getThread: patientId is required')
  if (!doctorId)  throw new Error('getThread: doctorId is required')
  try {
    return await request('GET', `/messages/${patientId}/${doctorId}`)
  } catch (err) {
    console.error(`[API] getThread(${patientId}, ${doctorId}) failed:`, err.message)
    throw err
  }
}

export async function sendMessage(data) {
  try {
    return await request('POST', '/messages', data)
  } catch (err) {
    console.error('[API] sendMessage failed:', err.message)
    throw err
  }
}

// ─── refill requests ──────────────────────────────────────────────────────────

export async function getPendingRefills() {
  try {
    return await request('GET', '/refill_requests/pending')
  } catch (err) {
    console.error('[API] getPendingRefills failed:', err.message)
    throw err
  }
}

export async function updateRefillStatus(id, status, notes = null) {
  if (!id)     throw new Error('updateRefillStatus: id is required')
  if (!status) throw new Error('updateRefillStatus: status is required')
  try {
    return await request('PUT', `/refill_requests/${id}/status`, { status, notes })
  } catch (err) {
    console.error(`[API] updateRefillStatus(${id}, ${status}) failed:`, err.message)
    throw err
  }
}

export async function createRefillRequest(prescriptionId) {
  if (!prescriptionId) throw new Error('createRefillRequest: prescriptionId is required')
  try {
    return await request('POST', '/refill_requests', { prescription_id: prescriptionId })
  } catch (err) {
    console.error(`[API] createRefillRequest(${prescriptionId}) failed:`, err.message)
    throw err
  }
}

export async function getRefillRequests(patientId) {
  if (!patientId) throw new Error('getRefillRequests: patientId is required')
  try {
    return await request('GET', `/refill_requests/patient/${patientId}`)
  } catch (err) {
    console.error(`[API] getRefillRequests(${patientId}) failed:`, err.message)
    throw err
  }
}

// ─── prescriptions ────────────────────────────────────────────────────────────

export async function createPrescription(data) {
  try {
    return await request('POST', '/prescriptions', data)
  } catch (err) {
    console.error('[API] createPrescription failed:', err.message)
    throw err
  }
}

export async function getPrescriptions(patientId) {
  if (!patientId) throw new Error('getPrescriptions: patientId is required')
  try {
    return await request('GET', `/prescriptions/${patientId}`)
  } catch (err) {
    console.error(`[API] getPrescriptions(${patientId}) failed:`, err.message)
    throw err
  }
}

export async function requestRefill(prescriptionId) {
  if (!prescriptionId) throw new Error('requestRefill: prescriptionId is required')
  try {
    return await request('POST', `/prescriptions/${prescriptionId}/refill`)
  } catch (err) {
    console.error(`[API] requestRefill(${prescriptionId}) failed:`, err.message)
    throw err
  }
}
