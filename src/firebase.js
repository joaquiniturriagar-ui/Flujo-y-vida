import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot, runTransaction } from "firebase/firestore";

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
  const docRef = doc(db, "users", "mainData");

  try {
    await runTransaction(db, async (transaction) => {
      const sfDoc = await transaction.get(docRef);
      if (!sfDoc.exists()) {
        transaction.set(docRef, newData);
        return;
      }

      const oldData = sfDoc.data();
      let updatedDebts = [...(newData.debts || [])];
      let updatedExps = [...(newData.exps || [])];

      // Buscamos si hay un gasto nuevo que no esté marcado como procesado
      updatedExps = updatedExps.map(exp => {
        if (!exp.processed) {
          const monto = Number(exp.amount || exp.originalAmount || 0);
          const tarjeta = String(exp.card || "").trim();

          // Buscamos la tarjeta en debts para sumar
          updatedDebts = updatedDebts.map(debt => {
            if (debt.name === tarjeta || debt.id === tarjeta) {
              return { ...debt, usado: (Number(debt.usado) || 0) + monto };
            }
            return debt;
          });

          // Marcamos como procesado para que el bucle se detenga aquí
          return { ...exp, processed: true };
        }
        return exp;
      });

      transaction.update(docRef, { 
        exps: updatedExps, 
        debts: updatedDebts,
        // Conservamos otros campos como 'bud' o 'pays' si existen
        ...newData 
      });
    });
    console.log("Transacción completada con éxito.");
  } catch (e) {
    console.error("Error en la transacción: ", e);
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
