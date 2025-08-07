import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAEoTkkjwwjinmQPvWE7W0hqwD8BfUprLE",
  authDomain: "buynabay-a6166.firebaseapp.com",
  projectId: "buynabay-a6166",
  storageBucket: "buynabay-a6166.appspot.com",
  messagingSenderId: "589330031369",
  appId: "1:589330031369:web:7214af3b39d840b78569d8",
  measurementId: "G-P28N29T1QN"
};

// Avoid reinitializing the app on hot reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };

