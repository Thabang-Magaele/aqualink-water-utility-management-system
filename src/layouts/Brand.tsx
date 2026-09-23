import { Droplet } from 'lucide-react'

/** AquaLink wordmark. `inverse` for use on the dark sidebar. */
export default function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <span
      className={`flex items-center gap-2 font-bold tracking-tight ${inverse ? 'text-white' : 'text-reservoir'}`}
    >
      <span className={`rounded-md p-1 ${inverse ? 'bg-white/12' : 'bg-reservoir text-white'}`}>
        <Droplet className="size-4" aria-hidden="true" />
      </span>
      <span className="text-lg">AquaLink</span>
    </span>
  )
}
