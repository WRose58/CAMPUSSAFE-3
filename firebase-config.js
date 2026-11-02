import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAVwEkG-Qe-hy7dCigmU-wuZDjpygIvJ9U",
  authDomain: "campus-safe-5cae1.firebaseapp.com",
  databaseURL: "https://campus-safe-5cae1-default-rtdb.firebaseio.com",
  projectId: "campus-safe-5cae1",
  storageBucket: "campus-safe-5cae1.firebasestorage.app",
  messagingSenderId: "695288599497",
  appId: "1:695288599497:web:68f54f46ab064ab5638e18",
  measurementId: "G-SYSSN2BXJV"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };