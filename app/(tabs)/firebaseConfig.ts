// firebaseConfig.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { enableIndexedDbPersistence, getFirestore } from "firebase/firestore";

import {
  Platform,
} from "react-native";

const firebaseConfig = {
  apiKey: "AIzaSyAJbSwzNt3LWBIL81oAhpZIV1sMcUPpOI0",
  authDomain: "multi-calendar-app-1379f.firebaseapp.com",
  projectId: "multi-calendar-app-1379f",
  storageBucket: "multi-calendar-app-1379f.firebasestorage.app",
  messagingSenderId: "633661996714",
  appId: "1:633661996714:web:2b3544698054dfd3765ad3",
  measurementId: "G-PSW8XJLG07",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

if (Platform.OS !== 'web') {
  enableIndexedDbPersistence(db).catch((err) => {
    console.log("Persistence failed:", err.code);
  });
}
