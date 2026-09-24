import { formatCurrency } from '../utils/format'

/** A rand amount coloured by meaning: owed (red), in credit (green), settled (grey). */
export default function BalanceText({ amount }: { amount: number }) {
  const tone = amount > 0 ? 'font-semibold text-fault' : amount < 0 ? 'text-clear' : 'text-ink/70'
  return (
    <span className={`tabular-nums ${tone}`}>
      {formatCurrency(amount)}
      {amount < 0 && <span className="sr-only"> in credit</span>}
    </span>
  )
}
