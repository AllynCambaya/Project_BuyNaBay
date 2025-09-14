import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyA7aJDh7TmU1tVJA75F7eBRG0sWkLJoQjg",
  authDomain: "buynabay-25781.firebaseapp.com",
  projectId: "buynabay-25781",
  storageBucket: "buynabay-25781.firebasestorage.app",
  messagingSenderId: "106062612580",
  appId: "1:106062612580:web:613adac9e61414d6ce7771",
  measurementId: "G-WGLYN9HX66"
};

// Avoid reinitializing the app on hot reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };

