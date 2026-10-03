import { defineString } from 'firebase-functions/params'

/**
 * Firestore triggers must run in the same region as the database.
 * Set FIRESTORE_REGION in functions/.env (see functions/.env.example).
 * Defined once here and shared by every trigger.
 */
export const firestoreRegion = defineString('FIRESTORE_REGION', {
  default: 'us-central1',
  description: 'Location of your Firestore database, e.g. africa-south1 or nam5→us-central1',
})
