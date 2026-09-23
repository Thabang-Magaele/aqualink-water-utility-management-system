#!/usr/bin/env node
/**
 * Assign a role from the command line, optionally creating the account.
 * Use it to create the FIRST admin (who can then use the Staff page) and demo staff.
 *
 *   npm --prefix functions run set-role -- <email> <role> [--create --name "Full Name" --password "..."]
 *
 * Credentials: point --key (or GOOGLE_APPLICATION_CREDENTIALS) at a service-account
 * JSON file from Firebase console → Project settings → Service accounts.
 * NEVER commit that file. .gitignore already excludes *-firebase-adminsdk-*.json.
 *
 * Emulators: set FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099,
 * FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 and GCLOUD_PROJECT=<project-id> instead of a key.
 */
import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { cert, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { applyRole, isRole, ROLES } from '../lib/shared/roles.js'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    create: { type: 'boolean', default: false },
    name: { type: 'string' },
    password: { type: 'string' },
    key: { type: 'string' },
  },
})

const [email, role] = positionals
function fail(message) {
  console.error(`\n✖ ${message}\n`)
  process.exit(1)
}

if (!email || !role)
  fail('Usage: set-role <email> <role> [--create --name "Name" --password "..."] [--key path.json]')
if (!isRole(role)) fail(`Unknown role "${role}". Use one of: ${ROLES.join(', ')}`)

const keyPath = values.key ?? process.env.GOOGLE_APPLICATION_CREDENTIALS
const usingEmulator = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST)
if (!keyPath && !usingEmulator)
  fail('Provide --key <service-account.json> or run against the emulators.')

initializeApp(
  keyPath && !usingEmulator
    ? { credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))) }
    : undefined,
)
const auth = getAuth()

let user
try {
  user = await auth.getUserByEmail(email)
} catch (error) {
  if (error.code !== 'auth/user-not-found') throw error
  if (!values.create)
    fail(`No account for ${email}. Add --create --name "..." --password "..." to create it.`)
  if (!values.password || values.password.length < 8)
    fail('--password must be at least 8 characters.')
  user = await auth.createUser({
    email,
    password: values.password,
    displayName: values.name ?? email,
  })
  console.log(`Created account ${email}`)
}

await applyRole(user.uid, role)
console.log(
  `✔ ${email} now has role "${role}" (uid ${user.uid}). They should sign out and back in.`,
)
process.exit(0)
