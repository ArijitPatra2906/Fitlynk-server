import admin from 'firebase-admin'

let firebaseInitialized = false

export const initializeFirebaseAdmin = () => {
  if (firebaseInitialized) {
    console.log('Firebase Admin already initialized')
    return admin
  }

  console.log('[Firebase Admin] Starting initialization...')
  console.log('[Firebase Admin] FIREBASE_ADMIN_KEY_PATH:', process.env.FIREBASE_ADMIN_KEY_PATH)
  console.log('[Firebase Admin] FIREBASE_ADMIN_KEY:', process.env.FIREBASE_ADMIN_KEY ? 'SET' : 'NOT SET')

  try {
    // Try to initialize from environment variable (for production)
    if (process.env.FIREBASE_ADMIN_KEY) {
      console.log('[Firebase Admin] Initializing from environment variable...')
      const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_KEY)
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      })
      console.log('✅ Firebase Admin initialized from environment variable')
      firebaseInitialized = true
    }
    // Try to initialize from file (for local development)
    else if (process.env.FIREBASE_ADMIN_KEY_PATH) {
      console.log('[Firebase Admin] Initializing from file path...')
      const serviceAccount = require('./firebase-admin-key.json')
      console.log('[Firebase Admin] Service account loaded:', !!serviceAccount)
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      })
      console.log('✅ Firebase Admin initialized from file')
      firebaseInitialized = true
    } else {
      console.error('⚠️ Firebase Admin not initialized - no credentials found')
      console.error('Firebase authentication will not work.')
      console.error('Please set FIREBASE_ADMIN_KEY or FIREBASE_ADMIN_KEY_PATH environment variable')
    }
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error)
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace')
  }

  return admin
}

// DO NOT initialize here - it runs before dotenv.config() in server.ts
// The initialization will be called from server.ts after env vars are loaded

export default admin
