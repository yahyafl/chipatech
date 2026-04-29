import { Link, useNavigate } from 'react-router-dom'
import { LogOut, User } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

interface PartnerLayoutProps {
  children: React.ReactNode
}

export function PartnerLayout({ children }: PartnerLayoutProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await logout()
    } finally {
      navigate('/login')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <Link to="/partner" className="flex items-center gap-3">
            <div className="rounded-lg bg-brand-600 p-1.5">
              <span className="text-white font-bold text-sm">TM</span>
            </div>
            <div>
              <p className="font-semibold text-gray-900">TradeMirror OS</p>
              <p className="text-xs text-gray-500">Partner Portal</p>
            </div>
          </Link>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                <User className="h-4 w-4" />
                <span>{user?.full_name ?? user?.email}</span>
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="z-50 min-w-[160px] rounded-xl bg-white p-1 shadow-lg border border-gray-100" align="end">
                <DropdownMenu.Item
                  onSelect={() => void handleLogout()}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer outline-none select-none"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  )
}
