/**
 * Decorative reservoir staff gauge with a water line, used on the brand panel.
 * Purely visual, hidden from screen readers.
 */
export default function GaugeMotif({ className = '' }: { className?: string }) {
  const ticks = Array.from({ length: 14 }, (_, i) => i)
  return (
    <svg
      viewBox="0 0 400 300"
      className={className}
      aria-hidden="true"
      preserveAspectRatio="xMaxYMax slice"
    >
      {/* Staff gauge: graduated markings like the ones fixed inside reservoirs */}
      <rect x="318" y="0" width="44" height="300" fill="#0e5d7e" />
      {ticks.map((i) => {
        const y = 8 + i * 21
        const major = i % 5 === 0
        return (
          <rect
            key={i}
            x="318"
            y={y}
            width={major ? 32 : 18}
            height={major ? 4 : 2.5}
            fill="#e8f0f2"
          />
        )
      })}

      {/* Water body with two layers and a bright water line */}
      <path
        d="M0 150 C60 140 110 160 170 150 S290 140 400 150 V300 H0 Z"
        fill="#1d7a94"
        opacity="0.55"
      />
      <path
        d="M0 172 C70 164 130 182 200 172 S320 164 400 174 V300 H0 Z"
        fill="#1d7a94"
        opacity="0.75"
      />
      <path
        d="M0 150 C60 140 110 160 170 150 S290 140 400 150"
        stroke="#e8f0f2"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  )
}
