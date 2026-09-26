/**
 * Re-exports the Admin SDK setup functions from the Cloud Functions' own copy of
 * firebase-admin. Tests that call server code (e.g. tests/rules/payments.test.ts)
 * must initialise the app through this module: the project root has a second copy
 * of firebase-admin (for the scripts), and each copy keeps its own list of apps.
 */
export { getApps, initializeApp } from 'firebase-admin/app'
export { getFirestore } from 'firebase-admin/firestore'
