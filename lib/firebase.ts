import { initializeApp, getApps } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// Firebase config — env vars override defaults (set in Vercel / .env.local)
const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY            ?? "AIzaSyBRvVUPTRTeRe3FHZnLgNNzRNJxJ2n2sNE",
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN        ?? "test-6e995.firebaseapp.com",
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID         ?? "test-6e995",
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET     ?? "test-6e995.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "920254429824",
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID             ?? "1:920254429824:web:06f8db93bbf8e377a30465",
  databaseURL:       process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL       ?? "https://test-6e995-default-rtdb.firebaseio.com",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getDatabase(app);
