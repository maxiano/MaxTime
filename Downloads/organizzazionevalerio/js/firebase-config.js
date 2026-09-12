import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const envApiKey = (typeof window !== 'undefined' && window.__ENV__?.FIREBASE_API_KEY) ? window.__ENV__.FIREBASE_API_KEY : null;

const firebaseConfig = {
  apiKey: envApiKey || "AIzaSyAGEPZjO0DnXAR9wJpOqfui5hYgJAYcE-k",
  authDomain: "gestione-valerio.firebaseapp.com",
  projectId: "gestione-valerio",
  storageBucket: "gestione-valerio.firebasestorage.app",
  messagingSenderId: "596812330710",
  appId: "1:596812330710:web:03ad86e55032728cd07b77",
  measurementId: "G-36RKDPZZ3T"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const docRef = doc(db, "turni_valerio", "overrides");
