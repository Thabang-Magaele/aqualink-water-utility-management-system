import { Search, X } from 'lucide-react'
import { useId } from 'react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  /** Also the accessible label, e.g. "Search customers by name or account number". */
  placeholder: string
  className?: string
}

/** Controlled search input. Pair with useDebouncedValue for Firestore queries. */
export default function SearchBar({
  value,
  onChange,
  placeholder,
  className = '',
}: SearchBarProps) {
  const id = useId()
  return (
    <div className={`relative ${className}`} role="search">
      <label htmlFor={id} className="sr-only">
        {placeholder}
      </label>
      <Search
        className="text-ink/45 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        aria-hidden="true"
      />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="border-ink/20 focus:border-channel focus:ring-channel/25 block w-full rounded-md border bg-white py-2.5 pr-9 pl-9 text-base shadow-xs focus:ring-2 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="text-ink/50 hover:bg-mist hover:text-ink absolute top-1/2 right-2 -translate-y-1/2 rounded p-1"
          aria-label="Clear search"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
