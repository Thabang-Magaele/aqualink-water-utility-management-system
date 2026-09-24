# AquaLink

AquaLink is a web-based MVP for **Silulumanzi**: a Customer Portal (accounts, bills, usage, leak reports) and a role-based Staff Console (call centre, technicians, billing, assets, water quality, communications), built on React and Firebase.

> Status: **Phase 8: leak and outage workflow.** Customers report problems; the call centre assigns technicians; technicians start and resolve jobs; everyone is notified; every change is recorded in the ticket history.

## Tech stack

| Layer    | Tools                                                        |
| -------- | ------------------------------------------------------------ |
| Frontend | React 19, TypeScript, Vite, React Router, Tailwind CSS v4    |
| UI       | Lucide React (icons), Recharts (charts)                      |
| Backend  | Firebase Auth, Cloud Firestore, Cloud Functions (TypeScript) |
| Hosting  | Firebase Hosting                                             |
| Quality  | ESLint, Prettier                                             |

## Prerequisites

- **Node.js 22** (`node -v`). The Cloud Functions runtime is Node 22 too; `.nvmrc` pins it.
- **Firebase CLI**: `npm install -g firebase-tools`
- **Java 11+**, only if you want to run the local Firebase emulators.
- A Google account with access to the team's Firebase project.

## First-time setup

```bash
git clone <your-repo-url> aqualink
cd aqualink
npm install
npm --prefix functions install

cp .env.example .env.local      # then paste the Firebase web config into .env.local
firebase login
firebase use --add              # pick the AquaLink project, alias it "default"

npm run dev                     # http://localhost:5173
```

On the sign-in page (development mode only) a status line should read **Connected to `<project-id>`. Firestore reachable, rules enforced.** If `.env.local` is missing values you'll see a setup screen listing them.

## Authentication (Phase 1)

- Firebase Authentication with email and password. Enable **Email/Password** under Authentication, then Sign-in method, in the Firebase console.
- `AuthProvider` (`src/context/`) tracks the signed-in user; any component reads it with `useAuth()`.
- `ProtectedRoute` shows a loader while Firebase restores the session, sends signed-out users to `/login`, and shows an access-denied page when a `roles` list is given and the user's role isn't in it. `GuestRoute` keeps signed-in users off `/login` and `/register`.
- Roles are read from **Firebase Custom Claims** in the ID token, never from client data. A user with no claim is treated as `customer`. Claims are set server-side from Phase 2.
- `/register` is for customers only. It creates the Auth account and a `users/{uid}` profile. Firestore rules only accept that profile with `role: "customer"`, so nobody can register themselves as staff.

## Roles and access (Phase 2)

| Role             | Staff sections                                                              |
| ---------------- | --------------------------------------------------------------------------- |
| `admin`          | Everything, including Staff (role management) and Audit Logs                |
| `call_centre`    | Customers, Accounts, Tickets                                                |
| `technician`     | Field Operations (assigned jobs only). **No** billing, accounts or payments |
| `billing`        | Customers, Accounts, Billing, Meters                                        |
| `asset_manager`  | Tickets (link assets), Assets                                               |
| `water_quality`  | Water Quality                                                               |
| `communications` | Communications                                                              |
| `customer`       | Customer portal (`/customer/*`), own records only                           |

**Where each layer lives**

- `src/routes/navigation.ts` defines every menu item and its allowed roles. The menu and the route guards both come from it, so they can't disagree.
- `firestore.rules` is the real security: each collection says which roles may read and write it. Customers' records carry `customerId` equal to their Firebase uid.
- The `api` Cloud Function (`functions/src/index.ts`) verifies the ID token and checks the role from its claims for every endpoint. The first endpoint is `POST /api/setUserRole` (admin only).

**Creating the first admin (and demo staff)**

Roles can only be set server-side, so the first admin is created with a script:

1. Firebase console → Project settings → Service accounts → **Generate new private key**. Save the JSON **outside** the repo (or in it; it is git-ignored). Never commit or share it.
2. Run:

```bash
npm --prefix functions install
npm --prefix functions run set-role -- admin@aqualink.demo admin --create --name "Demo Admin" --password "ChooseAPassword1" --key /path/to/key.json
```

Without `--create` it changes the role of an existing account. After that, the admin manages roles from **Staff** in the app. Users pick up a role change automatically within a few seconds (or on next sign-in).

**Proving the rules:** see [docs/security.md](docs/security.md). `npm run check:rules` runs quick static checks; `npm run test:rules` runs 54 tests against the Firestore emulator (needs Java).

**API note:** calling `/api/setUserRole` in the cloud requires the functions to be deployed, which needs the Blaze plan. Locally, run `firebase emulators:start` and set `VITE_USE_EMULATORS=true`.

## UI system (Phase 3)

Build every page from these instead of writing new styles. Run the app and open **/ui-kit** (development only, also in the account menu) to see them all live.

| Need                                       | Use                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| Page title, breadcrumbs, page actions      | `PageHeader` (breadcrumbs are automatic from the menu labels)                  |
| A boxed section                            | `Card`                                                                         |
| A number on a dashboard                    | `StatCard`                                                                     |
| Any list of records                        | `DataTable` (sorting, paging, loading, empty, error, mobile cards built in)    |
| A status (OPEN, PAID, ALERT…)              | `StatusBadge`. Add new statuses to `src/utils/status.ts`                       |
| Buttons                                    | `Button` with `variant` (`primary`, `secondary`, `danger`, `ghost`) and `size` |
| Form inputs                                | `FormInput`, `FormSelect`, `FormTextarea` (label, hint and error wired up)     |
| Search box                                 | `SearchBar` + `useDebouncedValue`                                              |
| Pop-up forms / questions                   | `Modal`, `ConfirmDialog`                                                       |
| "Saved" / "Failed" feedback                | `useToast()` for short messages, `Alert` for messages that should stay         |
| Nothing to show / failed to load / loading | `EmptyState`, `ErrorState`, `LoadingSkeleton`                                  |
| Money and dates                            | `formatCurrency`, `formatDate`, `formatRelative` in `src/utils/format.ts`      |

The shell lives in `src/layouts/`: `AppLayout` (sidebar on large screens, slide-in menu below 1024px), `Topbar` (notification bell, account menu) and `SidebarNav`, which reads the same role-aware config as the routes.

## Data model (Phase 4)

Full description, relationship diagram and query/index map: **[docs/data-model.md](docs/data-model.md)**.

- Types for all 14 collections: `src/types/models.ts` (plus `User` in `src/types/user.ts`).
- Typed collection references: `collections.tickets`, `ticketHistory(ticketId)`, … in `src/services/firestore.ts`. Reads come back with `id` filled in.
- Business helpers with no Firebase dependency: `roundMoney`, `calculateConsumption`, `generateReference`, `evaluateWaterQuality` in `src/utils/domain.ts`.
- Sample data: `npm run seed:sample -- --dry-run` checks it; add `--key <service-account.json>` to write it.

## Staff dashboard (Phase 6)

One dashboard for every staff role (`src/pages/staff/StaffDashboardPage.tsx`). What each role sees is data, not separate pages:

- `src/services/dashboardQueries.ts`: every figure (`METRICS`) and activity feed (`ACTIVITY_SOURCES`), the roles that see it, the collection it reads, and the exact Firestore query. Counts and sums run on the server (`getAggregateFromServer`), so no documents are downloaded.
- `src/pages/staff/dashboard/metricDisplay.ts`: label, icon, colour, hint and link for each figure.
- To add a figure: add a `METRICS` entry and a `METRIC_DISPLAY` entry. `npm test` checks its roles can read its collection; `npm run test:rules` proves the rules allow the real query.

Figures load independently: a failing or not-yet-indexed query shows a message on its own card only.

## Tests

| Command               | What it runs                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------- |
| `npm test`            | Unit and component tests (Vitest + Testing Library), files named `*.test.ts(x)` in `src/` |
| `npm run test:watch`  | Same, re-running on save                                                                  |
| `npm run check:rules` | Static checks on `firestore.rules`                                                        |
| `npm run test:rules`  | Every `tests/rules/*.test.ts` against the Firestore emulator                              |

## Customer management (Phase 7)

- **Customers** (`/staff/customers`) and **Accounts** (`/staff/accounts`): search by name, account number, phone (any format, e.g. `082 123 4567` or `+27 82…`), email or address; filter by area, status or "owes money".
- **Customer page** (`/staff/customers/:id`): contact details, each account with its meter and last reading, and history sections that follow the security rules. The call centre sees invoices and tickets and can edit contact details; billing sees invoices and payments; admin sees everything.
- Queries live in `src/services/customerQueries.ts`; `tests/rules/customers.test.ts` runs the same queries as every role to prove the page and the rules agree.
- **Search limit:** Firestore has no full-text search, so the directory loads up to 500 customers and 500 accounts and filters in the browser. That is instant at MVP scale. Beyond it, add a `searchKeywords` array per customer (queried with `array-contains`) or a search service such as Algolia or Typesense.

## Ticket workflow (Phase 8)

```text
Customer reports ─▶ Call centre assigns ─▶ Technician starts ─▶ Technician resolves ─▶ Customer sees "Resolved"
   /customer/report     /staff/tickets/:id     /staff/field/:id      (note required)        /customer/tickets/:id
```

- **Every action is data first.** `src/services/ticketActions.ts` builds exactly what each action writes: the ticket fields plus a history entry, saved together in one batch. `ticketPermissions()` decides which buttons each role sees.
- **The page never offers an action the rules refuse.** `tests/rules/tickets.test.ts` performs every offered action, for every role and ticket state, with those exact payloads.
- **Live updates.** The queue, job lists, ticket pages and the notification bell use Firestore listeners, so nobody needs to refresh.
- **Notifications** come from the `onTicketWritten` Cloud Function (`functions/src/triggers/`). The decision logic is `functions/src/shared/ticketEvents.ts`, unit-tested in `tests/functions/`. Customers hear about receipt, assignment, work starting, escalation and resolution; technicians about new jobs; the call centre and admins about new reports.

**One-time setup for the trigger:** Firestore triggers must run in your database's region. Copy `functions/.env.example` to `functions/.env` and set `FIRESTORE_REGION` (see the comments in that file), then run `firebase deploy --only functions`.

## Scripts

| Command                            | What it does                                                           |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `npm run dev`                      | Start the dev server                                                   |
| `npm run build`                    | Type-check and build to `dist/`                                        |
| `npm run preview`                  | Serve the production build locally                                     |
| `npm test`                         | Unit and component tests (Vitest)                                      |
| `npm run lint`                     | ESLint                                                                 |
| `npm run format` / `format:check`  | Prettier                                                               |
| `npm --prefix functions run build` | Compile Cloud Functions to `functions/lib`                             |
| `npm run seed:sample`              | Build, check and (with `--key`) write the sample dataset               |
| `npm run check:rules`              | Static checks on `firestore.rules` (no emulator needed)                |
| `npm run test:rules`               | Run the Firestore security-rules tests in the emulator                 |
| `firebase emulators:start`         | Run Auth, Firestore, Functions locally (set `VITE_USE_EMULATORS=true`) |

## Project structure

```text
src/
  components/   reusable UI pieces
  layouts/      page shells (sidebar, top bar), from Phase 3
  pages/        one component per screen
  routes/       route table (AppRoutes.tsx)
  services/     Firebase access and API calls (firebase.ts lives here)
  hooks/        custom React hooks
  context/      React context providers (AuthContext in Phase 1)
  types/        shared TypeScript types
  utils/        helpers (env.ts validates environment variables)
  assets/       images, static files
functions/
  src/index.ts  Cloud Functions (currently a `health` endpoint)
firebase.json            Hosting, Firestore, Functions, emulator config
firestore.rules          Security rules (Phase 0: deny everything)
firestore.indexes.json   Composite indexes
```

## Environment variables and secrets

`.env.local` holds the Firebase **web** config. These values identify the project and are safe in the browser; security comes from Firestore rules and Cloud Functions. **Never** put service-account keys, payment secrets or messaging tokens in `.env.local` or anywhere under `src/`. Server secrets go in Cloud Functions config later. `.env.local` is git-ignored.

## Notes

- Deploying Cloud Functions requires the Firebase **Blaze** (pay-as-you-go) plan. Everything else, including the Functions emulator, works on the free Spark plan.
- The functions region is `us-central1`, set in both `functions/src/index.ts` and `src/services/firebase.ts`. Change both together.

Full documentation (architecture, roles, API, deployment, demo accounts, limitations) is written in Phase 27.
