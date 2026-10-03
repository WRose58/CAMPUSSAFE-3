// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAVwEkG-Qe-hy7dCigmU-wuZDjpygIvJ9U",
  authDomain: "campus-safe-5cae1.firebaseapp.com",
  projectId: "campus-safe-5cae1",
  storageBucket: "campus-safe-5cae1.firebasestorage.app",
  messagingSenderId: "695288599497",
  appId: "1:695288599497:web:2e1b9818a2f7f236638e18",
  measurementId: "G-VZ3D0C45TC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);