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

export const saveData = async (newData) => {
  try {
    const docRef = doc(db, "users", "mainData");

    // Lógica de Auto-suma mejorada
    if (newData.exps && newData.debts) {
      // Obtenemos el último gasto
      const lastExp = newData.exps[newData.exps.length - 1];
      
      // Intentamos obtener el monto (probamos con amount o originalAmount)
      const monto = Number(lastExp.amount || lastExp.originalAmount || 0);
      
      // Obtenemos el nombre de la tarjeta que viene del gasto
      const tarjetaGasto = String(lastExp.card || "").trim().toLowerCase();

      if (monto > 0 && tarjetaGasto !== "") {
        newData.debts = newData.debts.map(debt => {
          const nombreD = String(debt.name || "").trim().toLowerCase();
          const idD = String(debt.id || "").trim().toLowerCase();

          // Si coincide el nombre o el ID
          if (nombreD === tarjetaGasto || idD === tarjetaGasto) {
            const actual = Number(debt.usado) || 0;
            return { ...debt, usado: actual + monto };
          }
          return debt;
        });
      }
    }

    // Guardar en Firebase
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
