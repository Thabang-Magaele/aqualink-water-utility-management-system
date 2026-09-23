# AquaLink security model

Security is enforced by **Firestore Security Rules** (`firestore.rules`) and **Cloud Functions**, never by
the React app. Hiding a menu item is convenience; the rules are what actually stop a request.

## Three checks on every write

1. **Who:** the role comes from the verified ID token's custom claim (`role`), set only by the server
   (`setUserRole`, `set-role` script). No claim means `customer`. Nothing the browser sends can change it.
2. **What:** each collection accepts an exact list of fields, correct types, values from fixed lists
   (areas, statuses, types), and server timestamps (`serverTimestamp()`) so records can't be back-dated.
   Some fields can never change after creation (a ticket's customer, an account's number…).
3. **Links:** cross-document checks, for example:
   - a meter reading must match its meter's account and customer, and can't be lower than the last reading;
   - an invoice's consumption and amount must equal the readings × tariff;
   - a customer can only report a ticket against their own account;
   - tickets can only be assigned to users whose role is `technician`;
   - a water test's NORMAL/ALERT status must match its result and limits, so an alert can't be hidden.

## Access by role

R = read, W = create/update (with the checks above), – = no access. "own" = records whose
`customerId`/`userId` is the signed-in user.

| Collection        | Customer             | Call centre | Technician            | Billing                 | Asset mgr     | Water quality | Comms | Admin                   |
| ----------------- | -------------------- | ----------- | --------------------- | ----------------------- | ------------- | ------------- | ----- | ----------------------- |
| users             | R/W own name & phone | –           | –                     | –                       | –             | –             | –     | R all                   |
| customers         | R own, W own phone   | R W         | –                     | R, link accounts        | –             | –             | –     | R W                     |
| accounts          | R own                | R           | –                     | R W                     | –             | –             | –     | R W                     |
| meters, readings  | R own                | R           | –                     | R W                     | –             | –             | –     | R W                     |
| invoices          | R own                | R           | –                     | R, create, mark overdue | –             | –             | –     | R, create, mark overdue |
| payments          | R own                | –           | –                     | R                       | –             | –             | –     | R                       |
| tickets           | R own, report        | R W         | R/W assigned (status) | –                       | R, link asset | –             | –     | R W                     |
| ticket history    | R own, add notes     | R, add      | R/add assigned        | –                       | R             | –             | –     | R, add                  |
| assets            | –                    | R           | R                     | R                       | R W           | R             | R     | R W                     |
| waterQualityTests | –                    | –           | –                     | –                       | R             | R W           | –     | R W                     |
| outageNotices     | R                    | R           | R                     | R                       | R             | R             | R W   | R W                     |
| notifications     | R own, mark read     | own         | own                   | own                     | own           | own           | own   | own                     |
| auditLogs         | –                    | –           | –                     | –                       | –             | –             | –     | R                       |

## Server-only writes

These can't be written from the browser by anyone, including admins. They are created by Cloud Functions
or the Admin SDK, which bypass the rules:

- **payments**, and marking an invoice **PAID** (the payment function, Phase 11)
- **notifications** (Phase 12)
- **auditLogs** (Phase 18)
- **roles** (custom claims, via `setUserRole`)

## Testing

- `npm run check:rules`: fast static check (no emulator): brackets, undefined functions, and that the
  value lists match `src/types/models.ts`.
- `npm run test:rules`: 54 tests against the real rules engine in the Firestore emulator, seeded with the
  sample dataset. Each "rejected" test proves an unauthorized read or write fails; each "allowed" test
  proves a legitimate app action still works.
