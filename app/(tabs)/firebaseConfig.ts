// firebaseConfig.ts の内容を全書き換え
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache } from "firebase/firestore";

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
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache()
});
export const auth = getAuth(app);