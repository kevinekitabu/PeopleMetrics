import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
const firebaseConfig = {
    apiKey: "AIzaSyCAGl1cVCCGK3dfiQRTy31-p1xvRuNoOnc",
    authDomain: "bolttest-42354.firebaseapp.com",
    projectId: "bolttest-42354",
    storageBucket: "bolttest-42354.firebasestorage.app",
    messagingSenderId: "200998069760",
    appId: "1:200998069760:web:7c717299293d5151ba5ae5"
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);
// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
