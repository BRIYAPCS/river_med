import { Outlet } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import BottomNavigation from '../components/BottomNavigation'

export default function Layout() {
  return (
    <div className="flex flex-col" style={{ minHeight: '100svh', background: 'var(--bg)' }}>
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6 pb-24 lg:pb-8"
          style={{ background: '#f8fafc' }}>
          <div className="max-w-4xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
      <BottomNavigation />
    </div>
  )
}
