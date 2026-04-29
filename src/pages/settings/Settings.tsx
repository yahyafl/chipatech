import { Navigate, useLocation, Link, Outlet } from 'react-router-dom'
import { Users, Building2, Landmark, FileSpreadsheet, History } from 'lucide-react'

const TABS = [
  { href: '/settings/users', label: 'Users', icon: Users },
  { href: '/settings/entities', label: 'Entities', icon: Building2 },
  { href: '/settings/banking', label: 'Banking', icon: Landmark },
  { href: '/settings/audit', label: 'Audit Trail', icon: History },
  { href: '/settings/tax-export', label: 'Tax Export', icon: FileSpreadsheet },
]

export default function Settings() {
  const location = useLocation()

  if (location.pathname === '/settings') {
    return <Navigate to="/settings/users" replace />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Manage platform users, entities, banking, and export</p>
      </div>

      <div className="flex border-b border-gray-200 gap-1">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = location.pathname === tab.href
          return (
            <Link
              key={tab.href}
              to={tab.href}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                isActive
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Link>
          )
        })}
      </div>

      <Outlet />
    </div>
  )
}
