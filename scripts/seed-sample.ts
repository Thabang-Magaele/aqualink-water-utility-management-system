/**
 * Writes the sample dataset to Firestore so every collection exists.
 *
 *   npm run seed:sample -- --dry-run                       # build + check only, no writes
 *   npm run seed:sample -- --key path/to/service-account.json
 *
 * Safe to re-run: documents have fixed IDs ("sample-…"), so they are overwritten, not duplicated.
 * If customer@aqualink.demo / technician@aqualink.demo exist in Auth, the sample customer and
 * tickets are linked to them so you can sign in and see the data.
 *
 * Emulators: set FIREBASE_AUTH_EMULATOR_HOST, FIRESTORE_EMULATOR_HOST and GCLOUD_PROJECT instead of --key.
 */
import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { cert, getApp, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { buildSampleData, type SampleIds } from './sample-data'
import { summarise, validateData } from './validate-data'

const { values } = parseArgs({
  options: {
    key: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
})

function fail(message: string): never {
  console.error(`\n✖ ${message}\n`)
  process.exit(1)
}

async function findUser(email: string) {
  try {
    return await getAuth().getUserByEmail(email)
  } catch {
    return undefined
  }
}

async function main() {
  const dryRun = values['dry-run']
  const ids: SampleIds = {}

  if (!dryRun) {
    const keyPath = values.key ?? process.env.GOOGLE_APPLICATION_CREDENTIALS
    const usingEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST)
    if (!keyPath && !usingEmulator) fail('Provide --key <service-account.json>, or use --dry-run.')
    initializeApp(
      keyPath && !usingEmulator
        ? { credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))) }
        : undefined,
    )

    const [customer, technician, admin] = await Promise.all([
      findUser('customer@aqualink.demo'),
      findUser('technician@aqualink.demo'),
      findUser('admin@aqualink.demo'),
    ])
    ids.customerUid = customer?.uid
    ids.technicianUid = technician?.uid
    ids.technicianName = technician?.displayName
    ids.staffUid = admin?.uid
    console.log(
      `Demo customer:   ${customer ? `linked (${customer.uid})` : 'not found, using a placeholder ID'}`,
    )
    console.log(
      `Demo technician: ${technician ? `linked (${technician.uid})` : 'not found, using a placeholder ID'}`,
    )
  }

  const docs = buildSampleData(ids)
  const errors = validateData(docs)
  if (errors.length) fail(`Sample data failed its checks:\n  - ${errors.join('\n  - ')}`)

  console.log('\nDocuments per collection:')
  console.table(summarise(docs))
  console.log('✔ All relationships and calculations check out.')

  if (dryRun) {
    console.log('\nDry run: nothing was written.')
    return
  }

  const db = getFirestore()
  const batch = db.batch()
  for (const d of docs) batch.set(db.doc(d.path), d.data)
  await batch.commit()
  console.log(
    `\n✔ Wrote ${docs.length} documents to project "${getApp().options.projectId ?? process.env.GCLOUD_PROJECT}".`,
  )
}

main().then(
  () => process.exit(0),
  (error) => fail(error instanceof Error ? error.message : String(error)),
)
