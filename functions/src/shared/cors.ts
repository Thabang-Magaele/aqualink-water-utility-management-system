/**
 * Websites allowed to call the API from a browser (CORS).
 * Built in: the local dev server and Firebase Hosting. Others (e.g. a Vercel
 * deployment) are added with ALLOWED_ORIGINS in functions/.env as a comma-separated
 * list of exact origins: ALLOWED_ORIGINS=https://aqualink.vercel.app
 *
 * CORS is not the security: every endpoint still requires a valid Firebase ID token.
 * It only decides which websites' JavaScript may read the responses.
 */
const BUILT_IN: (string | RegExp)[] = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /\.web\.app$/,
  /\.firebaseapp\.com$/,
]

/** Exact origins from a comma-separated setting; anything that isn't https://host is ignored. */
export function extraOrigins(setting: string | undefined): string[] {
  return (setting ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter((o) => /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(o))
}

export function corsOrigins(setting = process.env.ALLOWED_ORIGINS): (string | RegExp)[] {
  return [...BUILT_IN, ...extraOrigins(setting)]
}
