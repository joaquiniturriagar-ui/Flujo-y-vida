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

    // --- LÓGICA DE PROCESAMIENTO TOTAL ---
    if (newData.exps && newData.debts) {
      let debtsActualizados = [...newData.debts];
      let expsActualizados = newData.exps.map(exp => {
        
        // Si el gasto NO ha sido procesado (no tiene el campo 'done')
        if (!exp.done) {
          const monto = Number(exp.amount || 0);
          const tarjetaGasto = String(exp.card || "").trim().toLowerCase();

          if (monto > 0 && tarjetaGasto !== "") {
            // Buscamos la tarjeta en la lista de deudas
            debtsActualizados = debtsActualizados.map(debt => {
              const nombreD = String(debt.name || "").trim().toLowerCase();
              const idD = String(debt.id || "").trim().toLowerCase();

              // Si hay match, sumamos al campo 'usado'
              if (nombreD === tarjetaGasto || idD === tarjetaGasto) {
                console.log(`Sumando ${monto} a ${debt.name}`);
                return { ...debt, usado: (Number(debt.usado) || 0) + monto };
              }
              return debt;
            });
          }
          // Le ponemos el sello 'done' para que NUNCA más se vuelva a sumar
          return { ...exp, done: true };
        }
        // Si ya tenía el sello, lo dejamos tal cual
        return exp;
      });

      // Sobrescribimos con los datos procesados
      newData.exps = expsActualizados;
      newData.debts = debtsActualizados;
    }

    // Guardado definitivo
    await setDoc(docRef, newData);
    console.log("✅ Sincronización completada.");

  } catch (e) {
    console.error("❌ Error crítico:", e);
  }
};

export const onDataChange = (callback) => {
  return onSnapshot(doc(db, "users", "mainData"), (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data());
    }
  });
};

export { db };
