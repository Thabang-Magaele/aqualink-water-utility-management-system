import { describe, expect, it } from 'vitest'
import {
  isNewWaterAlert,
  outageMessage,
  planOutageEvent,
  waterAlertMessage,
  type OutageSnapshot,
  type WaterTestSnapshot,
} from '../../functions/src/shared/alerts'

const notice = (o: Partial<OutageSnapshot> = {}): OutageSnapshot => ({
  title: 'Hilltop Reservoir cleaning',
  description: 'Low pressure on higher ground.',
  affectedAreas: ['KaNyamazane', 'Tekwane'],
  status: 'SCHEDULED',
  severity: 'MEDIUM',
  startTime: new Date('2026-10-01T06:00:00Z'),
  expectedResolution: new Date('2026-10-01T16:00:00Z'),
  ...o,
})

describe('planOutageEvent', () => {
  it('a new notice notifies: scheduled or active; a new resolved notice does not', () => {
    expect(planOutageEvent(null, notice())).toBe('scheduled')
    expect(planOutageEvent(null, notice({ status: 'ACTIVE' }))).toBe('active')
    expect(planOutageEvent(null, notice({ status: 'RESOLVED' }))).toBeNull()
  })
  it('status changes notify: started, restored, or re-activated', () => {
    expect(planOutageEvent(notice(), notice({ status: 'ACTIVE' }))).toBe('started')
    expect(planOutageEvent(notice({ status: 'ACTIVE' }), notice({ status: 'RESOLVED' }))).toBe(
      'restored',
    )
    expect(planOutageEvent(notice({ status: 'RESOLVED' }), notice({ status: 'ACTIVE' }))).toBe(
      'active',
    )
  })
  it('editing the wording, or deleting a notice, does not message everyone again', () => {
    expect(planOutageEvent(notice(), notice({ description: 'Updated wording' }))).toBeNull()
    expect(planOutageEvent(notice(), null)).toBeNull()
  })
})

describe('outageMessage', () => {
  it('gives areas and times in South African time', () => {
    const m = outageMessage('scheduled', notice())
    expect(m.title).toBe('Planned outage: Hilltop Reservoir cleaning')
    expect(m.message).toMatch(
      /^KaNyamazane, Tekwane from .*08:00 until about .*18:00\. Low pressure/,
    )
  })
  it('tells people when supply is back', () => {
    expect(outageMessage('restored', notice()).message).toBe(
      'Water supply has been restored in KaNyamazane, Tekwane. Thank you for your patience.',
    )
  })
})

describe('water-quality alerts', () => {
  const test = (o: Partial<WaterTestSnapshot> = {}): WaterTestSnapshot => ({
    assetName: 'KaNyamazane Hilltop Reservoir',
    parameter: 'TURBIDITY',
    result: 1.8,
    unit: 'NTU',
    acceptableMin: null,
    acceptableMax: 1,
    status: 'ALERT',
    ...o,
  })
  it('notifies once, when a result becomes an alert', () => {
    expect(isNewWaterAlert(null, test())).toBe(true)
    expect(isNewWaterAlert(test({ status: 'NORMAL' }), test())).toBe(true)
    expect(isNewWaterAlert(test(), test({ result: 1.9 }))).toBe(false)
    expect(isNewWaterAlert(null, test({ status: 'NORMAL' }))).toBe(false)
  })
  it('explains the reading and the acceptable range', () => {
    expect(waterAlertMessage(test())).toEqual({
      title: 'Water quality alert: Turbidity at KaNyamazane Hilltop Reservoir',
      message: 'Turbidity measured 1.8 NTU; the acceptable range is at most 1 NTU.',
    })
    expect(
      waterAlertMessage(
        test({
          parameter: 'PH',
          result: 10.2,
          unit: 'pH units',
          acceptableMin: 5,
          acceptableMax: 9.7,
        }),
      ).message,
    ).toBe('pH measured 10.2 pH units; the acceptable range is 5–9.7 pH units.')
  })
})
