import { Navigate } from 'react-router-dom'

// The admin dashboard already contains the full patient queue board.
// This redirect keeps the nav link functional without duplicating code.
export default function AdminQueue() {
  return <Navigate to="/admin" replace />
}
