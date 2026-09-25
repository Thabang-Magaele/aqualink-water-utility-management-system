/** Test fixtures for the meter screens (fictional data). */
import type { Account, Meter, Reading } from '../../../types/models'

export const at = (iso: string) =>
  ({ toDate: () => new Date(iso) }) as unknown as Meter['createdAt']

export const meter: Meter = {
  id: 'm1',
  meterNumber: 'MTR-223107',
  accountId: 'a1',
  customerId: 'c1',
  installationDate: at('2024-01-10T10:00:00'),
  status: 'ACTIVE',
  lastReading: 1330.4,
  lastReadingDate: at('2026-08-25T10:00:00'),
  createdAt: at('2024-01-10T10:00:00'),
  updatedAt: at('2026-08-25T10:00:00'),
}

export const account: Account = {
  id: 'a1',
  accountNumber: '4100223107',
  customerId: 'c1',
  meterId: 'm1',
  balance: 467.4,
  status: 'ACTIVE',
  propertyAddress: '14 Mahlangu Street, KaNyamazane',
  area: 'KaNyamazane',
  createdAt: at('2024-01-10T10:00:00'),
  updatedAt: at('2026-08-25T10:00:00'),
}

const reading = (id: string, value: number, iso: string): Reading => ({
  id,
  meterId: 'm1',
  accountId: 'a1',
  customerId: 'c1',
  readingValue: value,
  readingDate: at(`${iso}T10:00:00`),
  recordedBy: id === 'r3' ? 'me' : 'someone',
  createdAt: at(`${iso}T10:00:00`),
})

/** Newest first, as the service returns them: 15.2 kL used in each of the last two months. */
export const readings: Reading[] = [
  reading('r3', 1330.4, '2026-08-25'),
  reading('r2', 1315.2, '2026-07-25'),
  reading('r1', 1300, '2026-06-25'),
]
