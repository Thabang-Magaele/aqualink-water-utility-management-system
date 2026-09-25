import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ConsumptionPeriod } from '../utils/consumption'
import { formatKl, formatMonth } from '../utils/format'

interface Props {
  series: ConsumptionPeriod[]
  /** Accessible summary, e.g. "Water used per reading period for meter MTR-223107". */
  label: string
  height?: number
}

/**
 * Bar chart of water used per reading period, in kL (say so in the card title). Screen readers get a text
 * summary; the same figures are always shown in a table beside the chart.
 */
export default function ConsumptionChart({ series, label, height = 240 }: Props) {
  const data = series
    .filter((p) => p.consumption !== null)
    .map((p) => ({ month: formatMonth(p.date), kl: p.consumption as number, days: p.days }))

  if (data.length === 0) {
    return (
      <p className="text-ink/60 py-10 text-center text-sm">
        A chart appears after the second reading.
      </p>
    )
  }

  const latest = data[data.length - 1]
  return (
    <figure>
      <figcaption className="sr-only">
        {label}. {data.length} periods; most recent {latest.month}: {formatKl(latest.kl)}.
      </figcaption>
      <div style={{ height }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid vertical={false} stroke="var(--color-mist)" />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: 'currentColor' }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              tick={{ fontSize: 12, fill: 'currentColor' }}
              tickFormatter={(v: number) => `${v}`}
            />
            <Tooltip
              cursor={{ fill: 'var(--color-mist)' }}
              formatter={(value) => [formatKl(Number(value)), 'Used']}
              labelFormatter={(month, payload) => {
                const days = payload?.[0]?.payload?.days
                return days ? `${month} (${days} days)` : String(month)
              }}
            />
            <Bar dataKey="kl" fill="var(--color-channel)" radius={[3, 3, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}
