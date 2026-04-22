import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBh9x8JiPrOKmaenMzLl31D1Qvd446XQFA",
  authDomain: "flujo-y-vida.firebaseapp.com",
  databaseURL: "https://flujo-y-vida-default-rtdb.firebaseio.com",
  projectId: "flujo-y-vida",
  storageBucket: "flujo-y-vida.firebasestorage.app",
  messagingSenderId: "655957911597",
  appId: "1:655957911597:web:81deebf9b78ae25580b0a4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Guarda el objeto completo sin procesar nada
export const saveData = async (data) => {
  try {
    await setDoc(doc(db, "users", "mainData"), data);
  } catch (e) {
    console.error("Error guardando datos: ", e);
  }
};

export const onDataChange = (callback) => {
  return onSnapshot(doc(db, "users", "mainData"), (doc) => {
    if (doc.exists()) callback(doc.data());
  });
};

export { db };
