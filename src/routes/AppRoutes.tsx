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
import AccountsPage from '../pages/staff/AccountsPage'
import MeterDetailPage from '../pages/staff/meters/MeterDetailPage'
import BillingPage from '../pages/staff/billing/BillingPage'
import InvoicePage from '../pages/staff/billing/InvoicePage'
import BillsPage from '../pages/customer/BillsPage'
import MetersPage from '../pages/staff/meters/MetersPage'
import UsagePage from '../pages/customer/UsagePage'
import CustomerDetailPage from '../pages/staff/customers/CustomerDetailPage'
import CustomersPage from '../pages/staff/customers/CustomersPage'
import FieldJobsPage from '../pages/staff/tickets/FieldJobsPage'
import TicketDetailPage from '../pages/staff/tickets/TicketDetailPage'
import TicketQueuePage from '../pages/staff/tickets/TicketQueuePage'
import CustomerTicketPage from '../pages/customer/CustomerTicketPage'
import MyTicketsPage from '../pages/customer/MyTicketsPage'
import ReportIssuePage from '../pages/customer/ReportIssuePage'
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
  '/staff/customers': <CustomersPage />,
  '/staff/accounts': <AccountsPage />,
  '/staff/meters': <MetersPage />,
  '/staff/billing': <BillingPage />,
  '/customer/bills': <BillsPage />,
  '/customer/usage': <UsagePage />,
  '/staff/tickets': <TicketQueuePage />,
  '/staff/field': <FieldJobsPage />,
  '/customer/report': <ReportIssuePage />,
  '/customer/tickets': <MyTicketsPage />,
  '/customer': <CustomerDashboardPage />,
}

/** Roles of a menu item, reused for its detail pages. */
function rolesOf(path: string) {
  return STAFF_NAV.find((i) => i.path === path)?.roles ?? []
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
        <Route element={<AppLayout />}>
          {guardedRoutes(STAFF_NAV)}
          {/* Detail pages share the roles of their parent menu item */}
          <Route element={<ProtectedRoute roles={rolesOf('/staff/billing')} />}>
            <Route
              path="/staff/billing/invoices/:invoiceId"
              element={<InvoicePage audience="staff" />}
            />
          </Route>
          <Route element={<ProtectedRoute roles={rolesOf('/staff/meters')} />}>
            <Route path="/staff/meters/:meterId" element={<MeterDetailPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={rolesOf('/staff/customers')} />}>
            <Route path="/staff/customers/:customerId" element={<CustomerDetailPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={rolesOf('/staff/tickets')} />}>
            <Route
              path="/staff/tickets/:ticketId"
              element={<TicketDetailPage section="/staff/tickets" />}
            />
          </Route>
          <Route element={<ProtectedRoute roles={rolesOf('/staff/field')} />}>
            <Route
              path="/staff/field/:ticketId"
              element={<TicketDetailPage section="/staff/field" />}
            />
          </Route>
        </Route>
      </Route>

      {/* Customer portal */}
      <Route element={<ProtectedRoute roles={['customer']} />}>
        <Route element={<AppLayout />}>
          {guardedRoutes(CUSTOMER_NAV)}
          <Route path="/customer/tickets/:ticketId" element={<CustomerTicketPage />} />
          <Route path="/customer/bills/:invoiceId" element={<InvoicePage audience="customer" />} />
        </Route>
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
