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

// Variable global para evitar procesar el mismo gasto dos veces en la misma sesión
let lastProcessedExpenseId = null;

export const saveData = async (newData) => {
  try {
    const docRef = doc(db, "users", "mainData");

    if (newData.exps && newData.exps.length > 0 && newData.debts) {
      const lastExp = newData.exps[newData.exps.length - 1];
      
      // SOLO procesamos si el ID del gasto es diferente al último que procesamos
      if (lastExp.id !== lastProcessedExpenseId) {
        const montoGasto = Number(lastExp.amount || lastExp.originalAmount || 0);
        const tarjetaDelGasto = String(lastExp.card || "").trim();

        if (montoGasto > 0 && tarjetaDelGasto !== "") {
          newData.debts = newData.debts.map(debt => {
            const nombreD = String(debt.name || "").trim();
            const idD = String(debt.id || "").trim();

            if (nombreD === tarjetaDelGasto || idD === tarjetaDelGasto) {
              const saldoAnterior = Number(debt.usado) || 0;
              return { ...debt, usado: saldoAnterior + montoGasto };
            }
            return debt;
          });
          
          // Marcamos este gasto como "ya procesado"
          lastProcessedExpenseId = lastExp.id;
        }
      }
    }

    await setDoc(docRef, newData);
  } catch (e) {
    console.error("Error en saveData: ", e);
  }
};

export const onDataChange = (callback) => {
  return onSnapshot(doc(db, "users", "mainData"), (doc) => {
    if (doc.exists()) {
      callback(doc.data());
    }
  });
};

export { db };
