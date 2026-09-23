# AquaLink

AquaLink is a web-based MVP for **Silulumanzi**: a Customer Portal (accounts, bills, usage, leak reports) and a role-based Staff Console (call centre, technicians, billing, assets, water quality, communications), built on React and Firebase.

> Status: **Phase 0: project foundation.** No features yet. The app shows the sign-in screen and confirms it can reach Firebase.

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

## Scripts

| Command                            | What it does                                                           |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `npm run dev`                      | Start the dev server                                                   |
| `npm run build`                    | Type-check and build to `dist/`                                        |
| `npm run preview`                  | Serve the production build locally                                     |
| `npm run lint`                     | ESLint                                                                 |
| `npm run format` / `format:check`  | Prettier                                                               |
| `npm --prefix functions run build` | Compile Cloud Functions to `functions/lib`                             |
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
