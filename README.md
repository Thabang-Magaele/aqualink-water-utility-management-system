# AquaLink

AquaLink is a web-based MVP for **Silulumanzi**: a Customer Portal (accounts, bills, usage, leak reports) and a role-based Staff Console (call centre, technicians, billing, assets, water quality, communications), built on React and Firebase.

> Status: **Phase 2: role-based access control.** Each role sees only its own sections, and Firestore rules and Cloud Functions enforce the same boundaries on the server.

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

**Proving the rules:** `npm run test:rules` runs `tests/rules/access.test.mjs` against the Firestore emulator (needs Java). It checks that technicians can't read billing data, billing can't modify assets, customers can't read other customers' accounts, and admins can reach admin data.

**API note:** calling `/api/setUserRole` in the cloud requires the functions to be deployed, which needs the Blaze plan. Locally, run `firebase emulators:start` and set `VITE_USE_EMULATORS=true`.

## Scripts

| Command                            | What it does                                                           |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `npm run dev`                      | Start the dev server                                                   |
| `npm run build`                    | Type-check and build to `dist/`                                        |
| `npm run preview`                  | Serve the production build locally                                     |
| `npm run lint`                     | ESLint                                                                 |
| `npm run format` / `format:check`  | Prettier                                                               |
| `npm --prefix functions run build` | Compile Cloud Functions to `functions/lib`                             |
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
