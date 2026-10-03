# AquaLink REST API

The `api` Cloud Function handles privileged and server-side operations. Everyday reads and
simple writes go straight to Firestore from the app, protected by the security rules (see
[security.md](security.md)); REST is used where the server must do the work.

- **Base URL:** `https://us-central1-<project-id>.cloudfunctions.net/api` (also `/api` on the Hosting site)
- **Method:** every endpoint is `POST` with a JSON body. `GET /api` lists the endpoints.
- **Sign-in:** send a Firebase ID token: `Authorization: Bearer <token>`. The caller's role comes from
  the token's verified custom claim, never from the request.
- **Every response** has the same shape:

```json
{ "success": true, "message": "Assigned to Bongani Dube.", "data": {} }
```

| Status | Meaning                                                                           |
| ------ | --------------------------------------------------------------------------------- |
| 200    | Done (`success: true`). A declined card is also 200, with `data.status: "FAILED"` |
| 400    | Invalid input; `message` names the field                                          |
| 401    | Missing or expired sign-in                                                        |
| 403    | Signed in, but this role may not do this                                          |
| 404    | Unknown endpoint, or the record doesn't exist                                     |
| 405    | Not a POST                                                                        |
| 409    | Not possible in the record's current state (e.g. already paid, already resolved)  |
| 500    | Server error (details go to the function logs, never the response)                |

**Retries:** endpoints that create something take an `idempotencyKey` (8–64 letters, digits or dashes,
new for each new request). Sending the same request again with the same key returns the first result
instead of doing it twice.

## Endpoints

| Endpoint             | Who                                       | What                                       |
| -------------------- | ----------------------------------------- | ------------------------------------------ |
| `setUserRole`        | admin                                     | Change a user's role                       |
| `assignTicket`       | admin, call_centre                        | Assign or reassign a ticket                |
| `updateTicketStatus` | admin, call_centre, technician (own jobs) | Escalate, start, resolve or reopen         |
| `generateInvoice`    | admin, billing                            | Invoice one account                        |
| `runBilling`         | admin, billing                            | Invoice every account with new consumption |
| `payment`            | customer (own invoices), admin, billing   | Pay by card; record EFT or cash            |
| `publishOutage`      | admin, communications                     | Publish an outage notice                   |
| `sendNotification`   | admin, communications                     | In-app message to users or an area         |

### `POST /api/setUserRole`

```json
{ "uid": "jmP4khuYe4O7qiQMF1n7FghmQLY2", "role": "technician" }
```

Roles: `admin`, `call_centre`, `technician`, `billing`, `asset_manager`, `water_quality`, `communications`,
`customer`. An admin can't remove their own admin role.

### `POST /api/assignTicket`

```json
{
  "ticketId": "sample-ticket-1",
  "technicianId": "jmP4khuYe4O7qiQMF1n7FghmQLY2",
  "note": "Customer home after 2pm."
}
```

`data`: `{ ticketId, status, assignedTechnicianId, assignedTechnicianName, changed }`. `changed: false` if
it was already assigned to that technician. 400 if the person isn't a technician; 409 if the ticket is resolved.

### `POST /api/updateTicketStatus`

```json
{ "ticketId": "sample-ticket-1", "status": "RESOLVED", "note": "Replaced the leaking stopcock." }
```

| Who                 | Allowed changes                                                                      |
| ------------------- | ------------------------------------------------------------------------------------ |
| admin, call_centre  | open or in progress → `ESCALATED`; anything → `RESOLVED`; resolved → `OPEN` (reopen) |
| technician, own job | open or escalated → `IN_PROGRESS`; in progress → `RESOLVED`                          |

Resolving needs a `note` of at least 10 characters: the customer reads it. These are the same rules as
the ticket page (a test checks they agree). `data`: `{ ticketId, from, status }`.

### `POST /api/generateInvoice` and `POST /api/runBilling`

```json
{ "accountId": "sample-acc-1", "dryRun": true }
```

```json
{ "dryRun": false }
```

`dryRun: true` previews without creating anything. See the Billing section of the README for how amounts are
calculated. Each invoice and its balance change are written in one transaction; the same reading is never
billed twice.

### `POST /api/payment`

```json
{
  "invoiceId": "sample-acc-1_sample-acc-1-r4",
  "method": "CARD",
  "idempotencyKey": "6f1c2b9e-3d1a-4f7b-9a51-0c2e8f4d7a10",
  "card": { "name": "T Mokoena", "number": "4242 4242 4242 4242", "expiry": "12/28", "cvc": "123" }
}
```

```json
{ "invoiceId": "…", "method": "EFT", "idempotencyKey": "…", "reference": "FNB 4100223107" }
```

The amount always comes from the invoice. Sandbox cards are listed in the README. `data`:
`{ paymentId, status, amount, reference, message, invoiceId, invoiceNumber, repeated }`.

### `POST /api/publishOutage`

```json
{
  "idempotencyKey": "outage-2026-10-01-matsulu",
  "title": "Main burst on Marula Road",
  "description": "Repairs under way. Supply may be off on higher ground.",
  "affectedAreas": ["Matsulu"],
  "startTime": "2026-10-01T06:00:00+02:00",
  "expectedResolution": "2026-10-01T15:00:00+02:00",
  "severity": "HIGH",
  "status": "ACTIVE"
}
```

`status`: `SCHEDULED` or `ACTIVE`. `severity`: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`. Areas must be from the
app's list. Customers with a property in an affected area are notified automatically. `data`: `{ noticeId, repeated }`.

### `POST /api/sendNotification`

```json
{
  "idempotencyKey": "msg-2026-10-01-meters",
  "title": "Meter reading on Friday",
  "message": "Please keep your gate unlocked.",
  "userIds": ["1KWKt5ikRHXhVGX4D7jT178kzyM2"]
}
```

```json
{
  "idempotencyKey": "msg-2026-10-01-tekwane",
  "title": "Pressure testing",
  "message": "Brief interruptions possible.",
  "areas": ["Tekwane"],
  "link": "/customer"
}
```

Send either `userIds` (up to 500) or `areas`. `link` is optional and must be an in-app path. `data`:
`{ recipients, sent }` (`sent` is lower than `recipients` if the request was a repeat).

## Trying it from PowerShell

```powershell
$apiKey  = "<VITE_FIREBASE_API_KEY from .env.local>"
$project = "aqualink-85d07"

# 1. Sign in as a demo user to get an ID token (valid for an hour)
$login = Invoke-RestMethod -Method Post `
  -Uri "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$apiKey" `
  -ContentType "application/json" `
  -Body (@{ email = "callcentre@aqualink.demo"; password = "callcentre@123"; returnSecureToken = $true } | ConvertTo-Json)
$headers = @{ Authorization = "Bearer $($login.idToken)" }
$api = "https://us-central1-$project.cloudfunctions.net/api"

# 2. List the endpoints
Invoke-RestMethod -Uri $api

# 3. Escalate a ticket
Invoke-RestMethod -Method Post -Uri "$api/updateTicketStatus" -Headers $headers -ContentType "application/json" `
  -Body (@{ ticketId = "sample-ticket-1"; status = "ESCALATED"; note = "Customer reports it is getting worse." } | ConvertTo-Json)
```

PowerShell 7 shows 4xx answers as errors; add `-SkipHttpErrorCheck` to see the JSON `message` instead.

## Adding an endpoint

1. Write the handler in `functions/src/routes/`: check the role with `requireRole`, validate with the helpers in
   `shared/validate.ts`, call the work in `shared/`, and finish with `sendSuccess`.
2. Register it in `routes` in `functions/src/index.ts` (with its roles and a one-line summary).
3. Add tests: routing, roles and validation in `tests/functions/api.test.ts`; the Firestore work against the
   emulator in `tests/rules/`.
4. Document it here.
