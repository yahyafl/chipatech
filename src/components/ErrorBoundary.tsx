import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'

interface Props { children: ReactNode }
interface State { error: Error | null }

// Catches uncaught render errors so the whole app doesn't white-screen.
// Async errors (in promises) won't be caught here — those still toast
// at the call site. This is a last-resort safety net for render-time
// failures: corrupted source PDFs, malformed cached data, library bugs, etc.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log for the dev / monitoring. Strip in prod via vite drop config.
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  reset = () => {
    this.setState({ error: null })
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md w-full rounded-2xl bg-white shadow-lg border border-gray-200 p-8 text-center space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-red-100 p-3">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Something went wrong</h1>
            <p className="mt-1 text-sm text-gray-500">
              The app hit an unexpected error. No data was lost — your last action did not save.
            </p>
          </div>
          {import.meta.env.DEV && (
            <pre className="text-left text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-auto max-h-40">
              {this.state.error.message}
            </pre>
          )}
          <button
            type="button"
            onClick={this.reset}
            className="rounded-xl bg-brand-600 px-6 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
          >
            Reload app
          </button>
        </div>
      </div>
    )
  }
}
