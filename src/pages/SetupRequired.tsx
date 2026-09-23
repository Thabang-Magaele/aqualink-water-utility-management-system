/**
 * Shown when .env.local is missing Firebase values, so developers get a
 * clear instruction instead of a blank screen or a cryptic Firebase error.
 */
export default function SetupRequired({ missing }: { missing: readonly string[] }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="border-fault/30 w-full max-w-lg rounded-lg border bg-white p-8">
        <h1 className="text-fault text-xl font-bold">Firebase is not configured</h1>
        <p className="text-ink/80 mt-3">
          Copy <code className="bg-mist rounded px-1">.env.example</code> to{' '}
          <code className="bg-mist rounded px-1">.env.local</code>, fill in your Firebase web app
          config, then restart <code className="bg-mist rounded px-1">npm run dev</code>.
        </p>
        <p className="mt-4 text-sm font-semibold">Missing values:</p>
        <ul className="mt-2 space-y-1 text-sm">
          {missing.map((key) => (
            <li key={key}>
              <code className="bg-mist rounded px-1">{key}</code>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
