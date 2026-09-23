/**
 * AquaLink data model: one interface per Firestore collection.
 *
 * Conventions (see docs/data-model.md):
 * - `id` is the Firestore document ID. It is NOT stored inside the document;
 *   the converters in services/firestore.ts add it on read and strip it on write.
 * - Dates are Firestore Timestamps.
 * - Money is in rand (ZAR), rounded to 2 decimals with roundMoney().
 * - Water volumes are in kilolitres (kL), as on South African municipal bills.
 * - `customerId` is copied onto every customer-owned record (account, meter,
 *   reading, invoice, payment, ticket) so security rules and queries can check
 *   ownership without extra reads. For customers who sign in, it equals their
 *   Firebase Auth uid.
 */
import type { Timestamp } from 'firebase/firestore'
import type { Role } from './user'

// ---------------------------------------------------------------------------
// Enumerations. Arrays for dropdowns and validation; types for the compiler.
// ---------------------------------------------------------------------------

export const ACCOUNT_STATUSES = ['ACTIVE', 'SUSPENDED', 'CLOSED'] as const
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number]

export const METER_STATUSES = ['ACTIVE', 'FAULTY', 'REMOVED'] as const
export type MeterStatus = (typeof METER_STATUSES)[number]

export const INVOICE_STATUSES = ['UNPAID', 'PAID', 'OVERDUE'] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

export const PAYMENT_STATUSES = ['PENDING', 'SUCCESS', 'FAILED'] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export const PAYMENT_METHODS = ['CARD', 'EFT', 'CASH'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED'] as const
export type TicketStatus = (typeof TICKET_STATUSES)[number]

export const TICKET_TYPES = [
  'LEAK',
  'BURST_PIPE',
  'NO_WATER',
  'LOW_PRESSURE',
  'WATER_QUALITY',
  'METER_FAULT',
  'OTHER',
] as const
export type TicketType = (typeof TICKET_TYPES)[number]

export const TICKET_TYPE_LABELS: Record<TicketType, string> = {
  LEAK: 'Leak',
  BURST_PIPE: 'Burst pipe',
  NO_WATER: 'No water',
  LOW_PRESSURE: 'Low pressure',
  WATER_QUALITY: 'Water quality concern',
  METER_FAULT: 'Meter fault',
  OTHER: 'Other',
}

export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const
export type Priority = (typeof PRIORITIES)[number]

export const ASSET_TYPES = ['RESERVOIR', 'BOREHOLE', 'TREATMENT_PLANT', 'PIPE'] as const
export type AssetType = (typeof ASSET_TYPES)[number]

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  RESERVOIR: 'Reservoir',
  BOREHOLE: 'Borehole',
  TREATMENT_PLANT: 'Treatment plant',
  PIPE: 'Pipe',
}

export const ASSET_STATUSES = ['ACTIVE', 'MAINTENANCE', 'OFFLINE'] as const
export type AssetStatus = (typeof ASSET_STATUSES)[number]

export const WATER_QUALITY_STATUSES = ['NORMAL', 'ALERT'] as const
export type WaterQualityStatus = (typeof WATER_QUALITY_STATUSES)[number]

export const OUTAGE_STATUSES = ['SCHEDULED', 'ACTIVE', 'RESOLVED'] as const
export type OutageStatus = (typeof OUTAGE_STATUSES)[number]

export const NOTIFICATION_TYPES = [
  'TICKET',
  'BILLING',
  'PAYMENT',
  'OUTAGE',
  'WATER_QUALITY',
  'SYSTEM',
] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export const AUDIT_ACTIONS = [
  'USER_LOGIN',
  'TICKET_CREATED',
  'TICKET_ASSIGNED',
  'TICKET_UPDATED',
  'TICKET_RESOLVED',
  'INVOICE_CREATED',
  'PAYMENT_RECORDED',
  'CUSTOMER_UPDATED',
  'ASSET_UPDATED',
  'WATER_TEST_RECORDED',
  'OUTAGE_PUBLISHED',
  'ROLE_CHANGED',
] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]

/** Service areas used for customers, assets and outage notices. Fictional demo list. */
export const AREAS = [
  'Mbombela CBD',
  'KaNyamazane',
  'Matsulu',
  'White River',
  'Tekwane',
  'Msogwaba',
  'Kabokweni',
  'Hazyview',
] as const
export type Area = (typeof AREAS)[number]

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

/** customers/{customerId}. For customers with a login, customerId = their Auth uid. */
export interface Customer {
  id: string
  name: string
  email: string
  phone: string
  address: string
  area: Area
  accountIds: string[]
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** accounts/{accountId}: one per property. */
export interface Account {
  id: string
  accountNumber: string
  customerId: string
  /** Null until a meter is installed. */
  meterId: string | null
  /** Amount owed in rand. Positive = customer owes; negative = in credit. */
  balance: number
  status: AccountStatus
  propertyAddress: string
  area: Area
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** meters/{meterId} */
export interface Meter {
  id: string
  meterNumber: string
  accountId: string
  customerId: string
  installationDate: Timestamp
  status: MeterStatus
  /** Latest reading value in kL (copied from readings for quick display). */
  lastReading: number
  lastReadingDate: Timestamp | null
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** readings/{readingId}: a cumulative meter value on a date. */
export interface Reading {
  id: string
  meterId: string
  accountId: string
  customerId: string
  /** Cumulative meter value in kL. */
  readingValue: number
  readingDate: Timestamp
  /** uid of the staff member who captured it. */
  recordedBy: string
  createdAt: Timestamp
}

/** invoices/{invoiceId} */
export interface Invoice {
  id: string
  invoiceNumber: string
  accountId: string
  customerId: string
  /** "YYYY-MM", e.g. "2026-09". Sorts and filters as text. */
  billingPeriod: string
  previousReading: number
  currentReading: number
  /** currentReading − previousReading, in kL. */
  consumption: number
  /** Rand per kL used for this invoice (kept so old invoices stay correct if tariffs change). */
  tariffRate: number
  amount: number
  status: InvoiceStatus
  dueDate: Timestamp
  paidAt: Timestamp | null
  createdAt: Timestamp
}

/** payments/{paymentId}: written only by the payment Cloud Function. */
export interface Payment {
  id: string
  invoiceId: string
  accountId: string
  customerId: string
  amount: number
  status: PaymentStatus
  paymentMethod: PaymentMethod
  /** Provider or mock reference shown on receipts, e.g. "MOCK-7F3K9Q". */
  reference: string
  /** "MOCK" in the MVP; the real gateway's name later. */
  provider: string
  paidAt: Timestamp | null
  createdAt: Timestamp
}

/** tickets/{ticketId}: leak, outage and fault reports. */
export interface Ticket {
  id: string
  ticketNumber: string
  customerId: string
  accountId: string | null
  assetId: string | null
  type: TicketType
  description: string
  priority: Priority
  status: TicketStatus
  /** Where the problem is. Stored on the ticket because technicians can't read customer records. */
  location: string
  area: Area
  /** Copied for display so lists don't need extra reads. */
  customerName: string
  assignedTechnicianId: string | null
  assignedTechnicianName: string | null
  /** uid of whoever reported it (the customer, or a call-centre agent). */
  createdBy: string
  createdAt: Timestamp
  updatedAt: Timestamp
  resolvedAt: Timestamp | null
}

/**
 * tickets/{ticketId}/ticketHistory/{entryId}: append-only log of changes and notes.
 * A subcollection so security rules can check access against the parent ticket.
 */
export interface TicketHistoryEntry {
  id: string
  /** Null for a note that doesn't change the status. */
  fromStatus: TicketStatus | null
  toStatus: TicketStatus | null
  note: string
  changedBy: string
  changedByName: string
  createdAt: Timestamp
}

/** assets/{assetId}: water infrastructure. */
export interface Asset {
  id: string
  /** Short code for field use, e.g. "RES-004". */
  code: string
  name: string
  type: AssetType
  /** Human-readable location, e.g. "Hilltop, KaNyamazane". */
  location: string
  area: Area
  status: AssetStatus
  description: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** waterQualityTests/{testId}: one parameter measured on one sample. */
export interface WaterQualityTest {
  id: string
  assetId: string
  /** Copied for display. */
  assetName: string
  sampleDate: Timestamp
  parameter: WaterQualityParameter
  result: number
  unit: string
  acceptableMin: number | null
  acceptableMax: number | null
  /** ALERT when result is outside [acceptableMin, acceptableMax]. */
  status: WaterQualityStatus
  recordedBy: string
  createdAt: Timestamp
}

/** notifications/{notificationId}: in-app messages for one user. */
export interface Notification {
  id: string
  userId: string
  title: string
  message: string
  type: NotificationType
  /** ID of the related ticket, invoice, outage… */
  relatedId: string | null
  /** In-app route to open when clicked, e.g. "/customer/tickets". */
  link: string | null
  read: boolean
  createdAt: Timestamp
}

/** outageNotices/{noticeId}: planned or unplanned supply interruptions. */
export interface OutageNotice {
  id: string
  title: string
  description: string
  /** Array so one notice can cover several areas and be queried with array-contains. */
  affectedAreas: Area[]
  startTime: Timestamp
  expectedResolution: Timestamp | null
  severity: Priority
  status: OutageStatus
  createdBy: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** auditLogs/{auditId}: written server-side only. */
export interface AuditLog {
  id: string
  userId: string
  /** Copied for display in the admin log. */
  userName: string
  userRole: Role
  action: AuditAction
  /** Collection name, e.g. "tickets". */
  entity: string
  entityId: string
  /** Short human summary, e.g. "Status OPEN → IN_PROGRESS". */
  details: string
  timestamp: Timestamp
}

// ---------------------------------------------------------------------------
// Water-quality parameters. Default limits based on SANS 241 (South African
// drinking-water standard); confirm the exact values with Silulumanzi before
// relying on them.
// ---------------------------------------------------------------------------

export const WATER_QUALITY_PARAMETERS = {
  PH: { label: 'pH', unit: 'pH units', min: 5.0, max: 9.7 },
  TURBIDITY: { label: 'Turbidity', unit: 'NTU', min: null, max: 1 },
  FREE_CHLORINE: { label: 'Free chlorine', unit: 'mg/L', min: 0.2, max: 5 },
  E_COLI: { label: 'E. coli', unit: 'count/100 mL', min: null, max: 0 },
  CONDUCTIVITY: { label: 'Electrical conductivity', unit: 'mS/m', min: null, max: 170 },
} as const satisfies Record<
  string,
  { label: string; unit: string; min: number | null; max: number | null }
>

export type WaterQualityParameter = keyof typeof WATER_QUALITY_PARAMETERS
