import { initializeApp } from
    "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

import { getAuth } from
    "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import { getFirestore } from
    "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAVwEkG-Qe-hy7dCigmU-wUZDjpygIvJ9U",
    authDomain: "campus-safe-5cae1.firebaseapp.com",
    projectId: "campus-safe-5cae1",
    storageBucket: "campus-safe-5cae1.firebasestorage.app",
    messagingSenderId: "69528859947",
    appId: "1:69528859947:web:2e1b9818a2f7f236638e18",
    measurementId: "G-VZ3D0C45TC"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);

export { auth, db };