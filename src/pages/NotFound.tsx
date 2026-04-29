import { Link } from 'react-router-dom'
import { Home, FileX } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gray-100">
          <FileX className="h-12 w-12 text-gray-400" />
        </div>
        <h1 className="text-4xl font-bold text-gray-900">404</h1>
        <p className="mt-2 text-xl font-semibold text-gray-700">Page not found</p>
        <p className="mt-2 text-gray-500">The page you're looking for doesn't exist.</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
        >
          <Home className="h-4 w-4" />
          Go home
        </Link>
      </div>
    </div>
  )
}
