import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getReactNativePersistence, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

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

const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});

const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
