// Import fungsi yang kita perlukan dari SDK Firebase
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Sila gantikan bahagian di bawah dengan kod config dari Notepad awak!
const firebaseConfig = {
  apiKey: "AIzaSyDxVosQecWFjsFN2mbJThtgALMotDH2BTs",
  authDomain: "sportpricetracker.firebaseapp.com",
  projectId: "sportpricetracker",
  storageBucket: "sportpricetracker.firebasestorage.app",
  messagingSenderId: "987705511584",
  appId: "1:987705511584:web:28203ee37772a5f1c143c5",
  measurementId: "G-Q1BRCYNCKF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Servis (Database & Auth)
export const db = getFirestore(app);
export const auth = getAuth(app);

export default app;