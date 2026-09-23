import type { ReactElement } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from '../layouts/AppLayout'
import CustomerDashboardPage from '../pages/customer/CustomerDashboardPage'
import LoginPage from '../pages/LoginPage'
import NotFoundPage from '../pages/NotFoundPage'
import RegisterPage from '../pages/RegisterPage'
import SectionPlaceholder from '../pages/SectionPlaceholder'
import StaffDashboardPage from '../pages/staff/StaffDashboardPage'
import UsersPage from '../pages/staff/UsersPage'
import UiKitPage from '../pages/dev/UiKitPage'
import { isDev } from '../utils/env'
import { STAFF_ROLES } from '../types/user'
import GuestRoute from './GuestRoute'
import { CUSTOMER_NAV, STAFF_NAV, type NavItem } from './navigation'
import ProtectedRoute from './ProtectedRoute'
import RoleHomeRedirect from './RoleHomeRedirect'

/** Pages that exist so far; every other nav item shows a placeholder. */
const PAGES: Record<string, ReactElement> = {
  '/staff': <StaffDashboardPage />,
  '/staff/users': <UsersPage />,
  '/customer': <CustomerDashboardPage />,
}

/** Each nav item becomes a route guarded by the same roles that show it in the menu. */
function guardedRoutes(items: NavItem[]) {
  return items.map((item) => (
    <Route key={item.path} element={<ProtectedRoute roles={item.roles} />}>
      <Route path={item.path} element={PAGES[item.path] ?? <SectionPlaceholder item={item} />} />
    </Route>
  ))
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />

      <Route element={<GuestRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<RoleHomeRedirect />} />
      </Route>

      {/* Staff console: any staff role, then per-section roles */}
      <Route element={<ProtectedRoute roles={STAFF_ROLES} />}>
        <Route element={<AppLayout />}>{guardedRoutes(STAFF_NAV)}</Route>
      </Route>

      {/* Customer portal */}
      <Route element={<ProtectedRoute roles={['customer']} />}>
        <Route element={<AppLayout />}>{guardedRoutes(CUSTOMER_NAV)}</Route>
      </Route>

      {/* Development-only component catalogue */}
      {isDev && (
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/ui-kit" element={<UiKitPage />} />
          </Route>
        </Route>
      )}

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
