import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA_sdnv366_fTaxICebPsDUbGgLSm27w3s",
  authDomain: "silkos.firebaseapp.com",
  projectId: "silkos",
  storageBucket: "silkos.firebasestorage.app",
  messagingSenderId: "493330629636",
  appId: "1:493330629636:web:09026abd75a60c79b66151"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);