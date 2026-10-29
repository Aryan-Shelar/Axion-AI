
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBiPeaHIiM6ExNEmZ57D0IAtJ0p8USz18E",
  authDomain: "axion-ai-04.firebaseapp.com",
  projectId: "axion-ai-04",
  storageBucket: "axion-ai-04.firebasestorage.app",
  messagingSenderId: "516989189450",
  appId: "1:516989189450:web:d3e78fa762da09f7cd55b3",
  measurementId: "G-MDLXHB83T4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, "axionai");
export const auth = getAuth(app);