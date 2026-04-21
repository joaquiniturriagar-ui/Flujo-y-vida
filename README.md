# Mi Flujo — Guía de instalación

Tu app de finanzas personal con sync entre celular y computador.

## Tiempo total: ~20 minutos

---

## Paso 1: Crear proyecto en Firebase (5 min)

1. Anda a https://console.firebase.google.com
2. Haz login con tu cuenta Google
3. Click "Agregar proyecto" → ponle nombre "mi-flujo" → siguiente → desactiva Google Analytics (no lo necesitas) → Crear proyecto
4. En el menú izquierdo, click "Firestore Database" → "Crear base de datos"
5. Selecciona modo "producción" → elige la ubicación más cercana (southamerica-east1) → Habilitar
6. Ve a Reglas y reemplaza todo por esto:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{doc} {
      allow read, write: if true;
    }
  }
}
```

7. Click "Publicar"
8. En el menú izquierdo, click el engranaje (⚙️) → "Configuración del proyecto"
9. Baja hasta "Tus apps" → click el ícono web (</>)
10. Ponle nombre "mi-flujo" → NO marques Firebase Hosting → "Registrar app"
11. Te muestra un bloque de código con `firebaseConfig`. **Copia esos valores.**

---

## Paso 2: Pegar tu config (2 min)

Abre el archivo `src/firebase.js` y reemplaza los valores placeholder con los tuyos:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",           // tu apiKey real
  authDomain: "mi-flujo.firebaseapp.com",
  projectId: "mi-flujo",
  storageBucket: "mi-flujo.appspot.com",
  messagingSenderId: "123...",
  appId: "1:123...:web:abc..."
};
```

---

## Paso 3: Subir a GitHub (5 min)

1. Anda a https://github.com → "New repository"
2. Nombre: "mi-flujo" → Privado → Create
3. Sube todos los archivos del proyecto (puedes arrastrar y soltar)

**O desde terminal:**
```bash
cd mi-flujo
git init
git add .
git commit -m "first commit"
git remote add origin https://github.com/TU_USUARIO/mi-flujo.git
git push -u origin main
```

---

## Paso 4: Desplegar en Vercel (5 min)

1. Anda a https://vercel.com → Login con GitHub
2. Click "Add New Project" → Importa tu repo "mi-flujo"
3. Framework: Vite → Deploy
4. En 1-2 minutos tienes tu URL: `mi-flujo-xxxxx.vercel.app`

---

## Paso 5: Instalar en el celular (1 min)

1. Abre la URL de Vercel en Chrome/Safari del celular
2. **Chrome Android:** menú (⋮) → "Agregar a pantalla de inicio"
3. **Safari iPhone:** compartir (↑) → "Agregar a pantalla de inicio"
4. Se instala como app con ícono propio

---

## ¡Listo!

Ahora puedes:
- Agregar gastos desde el celular → aparecen en el computador
- Registrar pagos a deuda desde cualquier dispositivo
- Ver tu flujo de caja actualizado en tiempo real
- La sincronización es automática (delay ~1 segundo)

---

## Estructura del proyecto

```
mi-flujo/
├── index.html          ← página principal
├── package.json        ← dependencias
├── vite.config.js      ← config del bundler
├── public/
│   └── manifest.json   ← para instalar como app
└── src/
    ├── main.jsx        ← entry point
    ├── firebase.js     ← conexión a Firebase (TU CONFIG ACÁ)
    └── App.jsx         ← toda la app
```

## Costo

- Firebase Firestore: GRATIS (hasta 50K lecturas/día)
- Vercel: GRATIS (proyectos personales)
- Total: $0/mes
