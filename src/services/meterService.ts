/**
 * Meter and reading operations for the staff and customer screens.
 * Reads are server-only (an unreachable server shows an error, never an empty list).
 * Writes are batched so a reading and the meter's "last reading" can't disagree.
 */
import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type Query,
} from 'firebase/firestore'
import type { Account, Customer, Meter, MeterStatus, Reading } from '../types/models'
import { customerQueries } from './customerQueries'
import { db } from './firebase'
import {
  linkMeterUpdate,
  meterAfterReading,
  meterQueries,
  meterStatusUpdate,
  newMeterPayload,
  readingPayload,
  type NewMeterInput,
} from './meterQueries'

async function rows<T>(q: Query): Promise<T[]> {
  const snap = await getDocsFromServer(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T)
}

export interface MeterRow {
  meter: Meter
  accountNumber: string
  propertyAddress: string
  customerName: string
}

/** Every meter joined with its account and customer (staff Meters page). */
export async function loadMeterList(): Promise<{
  meters: MeterRow[]
  accountsWithoutMeter: (Account & { customerName: string })[]
}> {
  const [meters, accounts, customers] = await Promise.all([
    rows<Meter>(meterQueries.allMeters(db)),
    rows<Account>(customerQueries.allAccounts(db)),
    rows<Customer>(customerQueries.allCustomers(db)),
  ])
  const accountById = new Map(accounts.map((a) => [a.id, a]))
  const nameById = new Map(customers.map((c) => [c.id, c.name]))
  return {
    meters: meters.map((meter) => ({
      meter,
      accountNumber: accountById.get(meter.accountId)?.accountNumber ?? '—',
      propertyAddress: accountById.get(meter.accountId)?.propertyAddress ?? '',
      customerName: nameById.get(meter.customerId) ?? 'Unknown customer',
    })),
    accountsWithoutMeter: accounts
      .filter((a) => a.meterId === null && a.status !== 'CLOSED')
      .map((a) => ({ ...a, customerName: nameById.get(a.customerId) ?? 'Unknown customer' })),
  }
}

export interface MeterDetail {
  meter: Meter
  account: Account | null
  readings: Reading[]
}

export async function loadMeter(meterId: string): Promise<MeterDetail | null> {
  const snap = await getDocFromServer(meterQueries.meter(db, meterId))
  if (!snap.exists()) return null
  const meter = { id: snap.id, ...snap.data() } as Meter
  const [accountSnap, readings] = await Promise.all([
    getDocFromServer(meterQueries.account(db, meter.accountId)),
    rows<Reading>(meterQueries.meterReadings(db, meterId)),
  ])
  return {
    meter,
    account: accountSnap.exists()
      ? ({ id: accountSnap.id, ...accountSnap.data() } as Account)
      : null,
    readings,
  }
}

/**
 * Installs a meter on an account: creates the meter and links the account in one
 * batch, then records the installation value as the first (baseline) reading.
 */
export async function addMeter(input: NewMeterInput, recordedBy: string): Promise<string> {
  const meterRef = doc(collection(db, 'meters'))
  const batch = writeBatch(db)
  batch.set(meterRef, newMeterPayload(input, serverTimestamp()))
  batch.update(
    meterQueries.account(db, input.accountId),
    linkMeterUpdate(meterRef.id, serverTimestamp()),
  )
  await batch.commit()

  // Separate write: the rules check a reading against the meter as it already exists.
  const meter = { id: meterRef.id, accountId: input.accountId, customerId: input.customerId }
  await writeBatch(db)
    .set(
      doc(collection(db, 'readings')),
      readingPayload(
        meter,
        input.initialReading,
        input.installationDate,
        recordedBy,
        serverTimestamp(),
      ),
    )
    .commit()
  return meterRef.id
}

/** Records a reading and updates the meter's last reading, atomically. */
export async function recordReading(
  meter: Meter,
  value: number,
  date: Date,
  recordedBy: string,
): Promise<void> {
  const batch = writeBatch(db)
  batch.set(
    doc(collection(db, 'readings')),
    readingPayload(meter, value, date, recordedBy, serverTimestamp()),
  )
  batch.update(meterQueries.meter(db, meter.id), meterAfterReading(value, date, serverTimestamp()))
  await batch.commit()
}

export async function setMeterStatus(meterId: string, status: MeterStatus): Promise<void> {
  await updateDoc(meterQueries.meter(db, meterId), meterStatusUpdate(status, serverTimestamp()))
}

export interface CustomerUsage {
  meters: Meter[]
  accounts: Account[]
  readings: Reading[]
}

/** The signed-in customer's meters, properties and reading history. */
export async function loadCustomerUsage(customerId: string): Promise<CustomerUsage> {
  const [meters, accounts, readings] = await Promise.all([
    rows<Meter>(meterQueries.customerMeters(db, customerId)),
    rows<Account>(meterQueries.customerAccounts(db, customerId)),
    rows<Reading>(meterQueries.customerReadings(db, customerId)),
  ])
  return { meters, accounts, readings }
}
