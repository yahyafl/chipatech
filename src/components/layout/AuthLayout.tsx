import { Link } from 'react-router-dom'

interface AuthLayoutProps {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center gap-3">
            <div className="rounded-xl bg-white p-2.5 shadow-lg">
              <img src="/logo.png" alt="TradeMirror" className="h-8 w-8" onError={(e) => {
                e.currentTarget.style.display = 'none'
              }} />
              <div className="h-8 w-8 hidden items-center justify-center rounded-lg bg-brand-600 text-white text-lg font-bold" style={{display: 'none'}}>T</div>
            </div>
            <div className="text-left">
              <p className="text-xl font-bold text-white">TradeMirror OS</p>
              <p className="text-xs text-brand-200">Chipa Farm LLC</p>
            </div>
          </Link>
        </div>
        <div className="rounded-2xl bg-white p-8 shadow-2xl">
          {children}
        </div>
      </div>
    </div>
  )
}
