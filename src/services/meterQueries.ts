/**
 * Queries and write payloads for meters and readings.
 * Take `db` as an argument so tests/rules/meters.test.ts runs exactly these
 * against the security rules as each role.
 */
import { collection, doc, limit, orderBy, query, where, type Firestore } from 'firebase/firestore'
import type { Meter, MeterStatus } from '../types/models'

export const METER_LIST_LIMIT = 500
/** Readings shown on a meter page (two years of monthly reads). */
export const METER_HISTORY_LIMIT = 24
/** Readings loaded for a customer's usage page (all their meters). */
export const CUSTOMER_HISTORY_LIMIT = 120

export const meterQueries = {
  allMeters: (db: Firestore) => query(collection(db, 'meters'), limit(METER_LIST_LIMIT)),
  meter: (db: Firestore, meterId: string) => doc(db, 'meters', meterId),
  account: (db: Firestore, accountId: string) => doc(db, 'accounts', accountId),
  meterReadings: (db: Firestore, meterId: string) =>
    query(
      collection(db, 'readings'),
      where('meterId', '==', meterId),
      orderBy('readingDate', 'desc'),
      limit(METER_HISTORY_LIMIT),
    ),
  customerMeters: (db: Firestore, customerId: string) =>
    query(collection(db, 'meters'), where('customerId', '==', customerId)),
  customerAccounts: (db: Firestore, customerId: string) =>
    query(collection(db, 'accounts'), where('customerId', '==', customerId)),
  customerReadings: (db: Firestore, customerId: string) =>
    query(
      collection(db, 'readings'),
      where('customerId', '==', customerId),
      orderBy('readingDate', 'desc'),
      limit(CUSTOMER_HISTORY_LIMIT),
    ),
}

export interface NewMeterInput {
  meterNumber: string
  accountId: string
  customerId: string
  installationDate: Date
  /** The value on the meter's dial when installed, in kL. */
  initialReading: number
}

/** meters/{id} for a newly installed meter. */
export function newMeterPayload(input: NewMeterInput, timestamp: unknown) {
  return {
    meterNumber: input.meterNumber.trim().toUpperCase(),
    accountId: input.accountId,
    customerId: input.customerId,
    installationDate: input.installationDate,
    status: 'ACTIVE' as MeterStatus,
    lastReading: input.initialReading,
    lastReadingDate: input.installationDate,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

/** Update to accounts/{id} linking its new meter. */
export function linkMeterUpdate(meterId: string, timestamp: unknown) {
  return { meterId, updatedAt: timestamp }
}

type MeterRef = Pick<Meter, 'id' | 'accountId' | 'customerId'>

/** readings/{id}: a cumulative meter value recorded by `recordedBy`. */
export function readingPayload(
  meter: MeterRef,
  value: number,
  date: Date,
  recordedBy: string,
  timestamp: unknown,
) {
  return {
    meterId: meter.id,
    accountId: meter.accountId,
    customerId: meter.customerId,
    readingValue: value,
    readingDate: date,
    recordedBy,
    createdAt: timestamp,
  }
}

/** Update to meters/{id} after a reading, so lists show the latest value. */
export function meterAfterReading(value: number, date: Date, timestamp: unknown) {
  return { lastReading: value, lastReadingDate: date, updatedAt: timestamp }
}

export function meterStatusUpdate(status: MeterStatus, timestamp: unknown) {
  return { status, updatedAt: timestamp }
}
