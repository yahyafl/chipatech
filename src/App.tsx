import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'react-hot-toast'
import { queryClient } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { AuthGuard } from '@/components/guards/AuthGuard'
import { RoleGuard } from '@/components/guards/RoleGuard'
import { AppLayout } from '@/components/layout/AppLayout'
import { PartnerLayout } from '@/components/layout/PartnerLayout'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorBoundary } from '@/components/ErrorBoundary'

// Auth pages
const Login = lazy(() => import('@/pages/auth/Login'))
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'))
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword'))
const AcceptInvite = lazy(() => import('@/pages/auth/AcceptInvite'))

// Dashboard
const Dashboard = lazy(() => import('@/pages/dashboard/Dashboard'))

// Trades
const TradeList = lazy(() => import('@/pages/trades/TradeList'))
const TradeDetail = lazy(() => import('@/pages/trades/TradeDetail'))
const TradeFolder = lazy(() => import('@/pages/trades/TradeFolder'))

// Contracts
const ContractWizard = lazy(() => import('@/pages/contracts/ContractWizard'))

// Clients
const ClientList = lazy(() => import('@/pages/clients/ClientList'))

// Contacts
const ContactList = lazy(() => import('@/pages/contacts/ContactList'))

// Settings
const Settings = lazy(() => import('@/pages/settings/Settings'))
const UserManagement = lazy(() => import('@/pages/settings/UserManagement'))
const EntityProfiles = lazy(() => import('@/pages/settings/EntityProfiles'))
const BankingProfiles = lazy(() => import('@/pages/settings/BankingProfiles'))
const AuditTrail = lazy(() => import('@/pages/settings/AuditTrail'))
const TaxExport = lazy(() => import('@/pages/settings/TaxExport'))

// Partner
const PartnerDashboard = lazy(() => import('@/pages/partner/PartnerDashboard'))
const PartnerTradeDetail = lazy(() => import('@/pages/partner/PartnerTradeDetail'))

// Internal
const InternalTradeList = lazy(() => import('@/pages/internal/InternalTradeList'))
const InternalTradeFolder = lazy(() => import('@/pages/internal/InternalTradeFolder'))

// 404
const NotFound = lazy(() => import('@/pages/NotFound'))

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <LoadingSpinner label="Loading..." />
  </div>
)

// Prefetch dropdown data as soon as the user is authenticated so it's
// already cached by the time they reach the Contract Wizard step 2.
function PrefetchOnAuth() {
  const { user } = useAuth()
  useEffect(() => {
    if (!user) return
    void queryClient.prefetchQuery({
      queryKey: ['wizard-setup'],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      queryFn: () => (supabase as any).rpc('get_wizard_setup_data').then((r: any) => { if (r.error) throw r.error; return r.data }),
      staleTime: 5 * 60 * 1000,
    })
  }, [user])
  return null
}

function RootRedirect() {
  const { role, isLoading } = useAuth()
  // If role is not yet known and still loading, wait — otherwise redirect immediately
  if (!role && isLoading) return <PageLoader />
  if (role === 'partner') return <Navigate to="/partner" replace />
  if (role === 'internal') return <Navigate to="/internal/trades" replace />
  return <Navigate to="/dashboard" replace />
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PrefetchOnAuth />
          <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/accept-invite" element={<AcceptInvite />} />

              {/* Root redirect */}
              <Route path="/" element={<AuthGuard><RootRedirect /></AuthGuard>} />

              {/* SuperAdmin + Internal: AppLayout */}
              <Route element={
                <AuthGuard>
                  <RoleGuard allowedRoles={['super_admin', 'internal']}>
                    <AppLayout />
                  </RoleGuard>
                </AuthGuard>
              }>
                {/* Dashboard — SuperAdmin only */}
                <Route path="/dashboard" element={
                  <RoleGuard allowedRoles={['super_admin']} redirectTo="/internal/trades">
                    <Dashboard />
                  </RoleGuard>
                } />

                {/* Trades — SuperAdmin only (financials visible).
                    Internal users use /internal/trades instead. */}
                <Route path="/trades" element={
                  <RoleGuard allowedRoles={['super_admin']} redirectTo="/internal/trades">
                    <TradeList />
                  </RoleGuard>
                } />
                <Route path="/trades/:id" element={
                  <RoleGuard allowedRoles={['super_admin']} redirectTo="/internal/trades">
                    <TradeDetail />
                  </RoleGuard>
                } />
                <Route path="/trades/:id/folder" element={
                  <RoleGuard allowedRoles={['super_admin']} redirectTo="/internal/trades">
                    <TradeFolder />
                  </RoleGuard>
                } />

                {/* Contracts — SuperAdmin only */}
                <Route path="/contracts/new" element={
                  <RoleGuard allowedRoles={['super_admin']} redirectTo="/internal/trades">
                    <ContractWizard />
                  </RoleGuard>
                } />

                {/* Clients — SuperAdmin (full) + Internal (view-only) */}
                <Route path="/clients" element={
                  <RoleGuard allowedRoles={['super_admin', 'internal']}>
                    <ClientList />
                  </RoleGuard>
                } />

                {/* Contacts — SuperAdmin only */}
                <Route path="/contacts" element={
                  <RoleGuard allowedRoles={['super_admin']} redirectTo="/internal/trades">
                    <ContactList />
                  </RoleGuard>
                } />

                {/* Settings — SuperAdmin only */}
                <Route path="/settings" element={
                  <RoleGuard allowedRoles={['super_admin']} redirectTo="/trades">
                    <Settings />
                  </RoleGuard>
                }>
                  <Route path="users" element={<UserManagement />} />
                  <Route path="entities" element={<EntityProfiles />} />
                  <Route path="banking" element={<BankingProfiles />} />
                  <Route path="audit" element={<AuditTrail />} />
                  <Route path="tax-export" element={<TaxExport />} />
                </Route>

                {/* Internal team routes */}
                <Route path="/internal/trades" element={
                  <RoleGuard allowedRoles={['super_admin', 'internal']}>
                    <InternalTradeList />
                  </RoleGuard>
                } />
                <Route path="/internal/trades/:id/folder" element={
                  <RoleGuard allowedRoles={['super_admin', 'internal']}>
                    <InternalTradeFolder />
                  </RoleGuard>
                } />
              </Route>

              {/* Partner routes — PartnerLayout wraps each route as children */}
              <Route path="/partner" element={
                <AuthGuard>
                  <RoleGuard allowedRoles={['partner']}>
                    <PartnerLayout>
                      <Suspense fallback={<PageLoader />}>
                        <PartnerDashboard />
                      </Suspense>
                    </PartnerLayout>
                  </RoleGuard>
                </AuthGuard>
              } />
              <Route path="/partner/trades/:id" element={
                <AuthGuard>
                  <RoleGuard allowedRoles={['partner']}>
                    <PartnerLayout>
                      <Suspense fallback={<PageLoader />}>
                        <PartnerTradeDetail />
                      </Suspense>
                    </PartnerLayout>
                  </RoleGuard>
                </AuthGuard>
              } />

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: { borderRadius: '12px', fontSize: '14px' },
              success: { iconTheme: { primary: '#16a34a', secondary: '#fff' } },
              error: { iconTheme: { primary: '#dc2626', secondary: '#fff' } },
            }}
          />
        </AuthProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
