import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getAnalytics } from "firebase/analytics";

// AuraSync LM Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCtVW3qIb0uHRmlzhJkZdo1_IRCybxW2j8",
  authDomain: "aurasync-lm.firebaseapp.com",
  projectId: "aurasync-lm",
  storageBucket: "aurasync-lm.firebasestorage.app",
  messagingSenderId: "966702117724",
  appId: "1:966702117724:web:84d8b14ff5da73367c4799",
  measurementId: "G-346JB4T8R6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getDatabase(app);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

export default app;
