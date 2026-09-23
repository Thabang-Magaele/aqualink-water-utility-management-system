/** Shared look for inputs, selects and textareas. */
export function controlClass(hasError: boolean) {
  return `block w-full rounded-md border bg-white px-3 py-2.5 text-base shadow-xs focus:ring-2 focus:outline-none disabled:bg-paper disabled:text-ink/60 ${
    hasError
      ? 'border-fault focus:border-fault focus:ring-fault/20'
      : 'border-ink/20 focus:border-channel focus:ring-channel/25'
  }`
}
