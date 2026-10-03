/**
 * Notifications for outage notices (customers in the affected areas) and
 * abnormal water-quality results (water-quality staff, asset managers, admins).
 * The decisions are in shared/alerts.ts; the writes in shared/alertStore.ts.
 */
import * as logger from 'firebase-functions/logger'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import {
  isNewWaterAlert,
  planOutageEvent,
  type OutageSnapshot,
  type WaterTestSnapshot,
} from '../shared/alerts'
import { notifyOutage, notifyWaterAlert } from '../shared/alertStore'
import { firestoreRegion } from '../shared/region'

export const onOutageNoticeWritten = onDocumentWritten(
  { document: 'outageNotices/{noticeId}', region: firestoreRegion },
  async (event) => {
    const before = event.data?.before.exists ? (event.data.before.data() as OutageSnapshot) : null
    const after = event.data?.after.exists ? (event.data.after.data() as OutageSnapshot) : null
    const kind = planOutageEvent(before, after)
    if (!kind || !after) return
    const sent = await notifyOutage(event.params.noticeId, kind, after)
    logger.info(`Outage ${event.params.noticeId} (${kind}): ${sent} notification(s)`)
  },
)

export const onWaterQualityTestWritten = onDocumentWritten(
  { document: 'waterQualityTests/{testId}', region: firestoreRegion },
  async (event) => {
    const before = event.data?.before.exists
      ? (event.data.before.data() as WaterTestSnapshot)
      : null
    const after = event.data?.after.exists ? (event.data.after.data() as WaterTestSnapshot) : null
    if (!isNewWaterAlert(before, after)) return
    const sent = await notifyWaterAlert(event.params.testId, after!)
    logger.info(`Water test ${event.params.testId} alert: ${sent} notification(s)`)
  },
)
