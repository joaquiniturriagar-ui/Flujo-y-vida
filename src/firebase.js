import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // Añade esta línea

const firebaseConfig = {
  apiKey: "AIzaSyBh9x8JiPrOKmaenMzLl31D1Qvd446XQFA",
  authDomain: "flujo-y-vida.firebaseapp.com",
  databaseURL: "https://flujo-y-vida-default-rtdb.firebaseio.com",
  projectId: "flujo-y-vida",
  storageBucket: "flujo-y-vida.firebasestorage.app",
  messagingSenderId: "655957911597",
  appId: "1:655957911597:web:81deebf9b78ae25580b0a4"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);

// Inicializa Firestore y expórtalo para usarlo en otros archivos
export const db = getFirestore(app);