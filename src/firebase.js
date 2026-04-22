import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot, getDoc } from "firebase/firestore";

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

// Función mejorada con "Auto-Suma" de deudas
export const saveData = async (newData) => {
  try {
    const docRef = doc(db, "users", "mainData");
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const oldData = docSnap.data();
      
      // 1. Detectar si hay un gasto nuevo comparando las listas
      if (newData.exps && newData.exps.length > (oldData.exps?.length || 0)) {
        const lastExpense = newData.exps[newData.exps.length - 1];
        
        // 2. Si el gasto tiene una tarjeta asignada, actualizar el saldo 'usado'
        if (lastExpense.card && newData.debts) {
          newData.debts = newData.debts.map(debt => {
            // Comparamos por ID o por Name para asegurar el "match"
            if (debt.id === lastExpense.card || debt.name === lastExpense.card) {
              const currentUsado = Number(debt.usado) || 0;
              const expenseAmount = Number(lastExpense.amount) || 0;
              return { ...debt, usado: currentUsado + expenseAmount };
            }
            return debt;
          });
        }
      }
    }

    // 3. Guardar los datos ya actualizados
    await setDoc(docRef, newData);
  } catch (e) {
    console.error("Error guardando datos con auto-suma: ", e);
  }
};

export const onDataChange = (callback) => {
  return onSnapshot(doc(db, "users", "mainData"), (doc) => {
    callback(doc.data());
  });
};

export { db };
