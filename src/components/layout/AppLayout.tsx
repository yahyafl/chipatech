import { useState } from 'react'
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom'
import {
  LayoutDashboard, FileText, Plus, Users, UserCircle, Settings,
  LogOut, Bell, Menu, X, ChevronDown, FolderOpen
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/hooks/useNotifications'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles: string[]
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['super_admin'] },
  { label: 'Trades', href: '/trades', icon: FolderOpen, roles: ['super_admin', 'internal'] },
  { label: 'New Contract', href: '/contracts/new', icon: Plus, roles: ['super_admin'] },
  { label: 'Clients', href: '/clients', icon: Users, roles: ['super_admin'] },
  { label: 'Contacts', href: '/contacts', icon: UserCircle, roles: ['super_admin'] },
  { label: 'Settings', href: '/settings', icon: Settings, roles: ['super_admin'] },
]

export function AppLayout() {
  const { user, role, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { data: notifications } = useNotifications()
  const unreadCount = notifications?.filter((n) => !n.read).length ?? 0

  const filteredNav = navItems.filter((item) => role && item.roles.includes(role))

  const handleLogout = async () => {
    try {
      await logout()
    } finally {
      navigate('/login')
    }
  }

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
        <div className="rounded-lg bg-brand-600 p-1.5">
          <span className="text-white font-bold text-sm px-0.5">TM</span>
        </div>
        <div>
          <p className="font-semibold text-gray-900 text-sm">TradeMirror OS</p>
          <p className="text-xs text-gray-500">Chipa Farm LLC</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {filteredNav.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                isActive
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="border-t border-gray-100 p-3">
        <div className="flex items-center gap-3 rounded-xl px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-sm font-semibold">
            {user?.full_name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">{user?.full_name}</p>
            <p className="truncate text-xs text-gray-500 capitalize">{role?.replace('_', ' ')}</p>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-gray-200 shadow-sm z-30">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-64 h-full bg-white shadow-xl">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-gray-400 hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-6 shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden rounded-lg p-2 text-gray-400 hover:bg-gray-100"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            {/* Notifications */}
            <Link
              to="/settings"
              className="relative rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>

            {/* User menu */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-semibold">
                    {user?.full_name?.[0]?.toUpperCase() ?? 'U'}
                  </div>
                  <span className="hidden md:block font-medium">{user?.full_name}</span>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="z-50 min-w-[200px] rounded-xl bg-white p-1 shadow-lg border border-gray-100"
                  align="end"
                  sideOffset={8}
                >
                  <div className="px-3 py-2 border-b border-gray-100 mb-1">
                    <p className="text-sm font-medium text-gray-900">{user?.full_name}</p>
                    <p className="text-xs text-gray-500">{user?.email}</p>
                  </div>
                  <DropdownMenu.Item asChild>
                    <Link
                      to="/settings"
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className="my-1 h-px bg-gray-100" />
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

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
