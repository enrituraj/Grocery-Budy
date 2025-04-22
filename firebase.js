// firebase.tsx
import { initializeApp } from "firebase/app";
import { getAuth, initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// Your Firebase configuration
// Replace with your actual Firebase config values

const firebaseConfig = {

  apiKey: "AIzaSyAnOtpXRt4wY8uE2zgndJz2cox1dnhqzXM",

  authDomain: "coinsplit-52496.firebaseapp.com",

  projectId: "coinsplit-52496",

  storageBucket: "coinsplit-52496.firebasestorage.app",

  messagingSenderId: "954972632805",

  appId: "1:954972632805:web:5e09cb84ae831ae037c60c",

  measurementId: "G-G6BJCQ4CE2"

};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with AsyncStorage persistence
const auth = Platform.OS === 'web' 
  ? getAuth(app) 
  : initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });

// Initialize Firestore
const db = getFirestore(app);

export { auth, db };