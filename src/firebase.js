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

export const saveData = async (newData) => {
  try {
    const docRef = doc(db, "users", "mainData");
    
    // 1. Obtenemos lo que hay actualmente en Firebase para comparar
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      await setDoc(docRef, newData);
      return;
    }
    const oldData = snap.data();

    // 2. Revisamos si hay un gasto nuevo (el último de la lista)
    if (newData.exps && newData.exps.length > 0) {
      const lastExpIndex = newData.exps.length - 1;
      const lastExp = newData.exps[lastExpIndex];

      // SOLO procesamos si el gasto NO tiene la marca 'processed'
      // Esto evita que el bucle infinito empiece
      if (lastExp && !lastExp.processed) {
        const montoGasto = Number(lastExp.amount || lastExp.originalAmount || 0);
        const tarjetaGasto = String(lastExp.card || "").trim();

        if (montoGasto > 0 && tarjetaGasto !== "" && newData.debts) {
          // Actualizamos la deuda en el objeto que vamos a guardar
          newData.debts = newData.debts.map(debt => {
            const nombreD = String(debt.name || "").trim();
            const idD = String(debt.id || "").trim();
            
            if (nombreD === tarjetaGasto || idD === tarjetaGasto) {
              const actual = Number(debt.usado) || 0;
              return { ...debt, usado: actual + montoGasto };
            }
            return debt;
          });

          // MARCAMOS EL GASTO COMO PROCESADO
          // Así, cuando onSnapshot detecte el cambio, este IF ya no entrará
          newData.exps[lastExpIndex] = { ...lastExp, processed: true };
        }
      }
    }

    // 3. Guardamos los datos finales
    await setDoc(docRef, newData);
    console.log("Guardado exitoso con freno de bucle.");

  } catch (e) {
    console.error("Error al guardar: ", e);
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
