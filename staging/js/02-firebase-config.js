/* ═══════════════ FIREBASE CONFIG (STAGING — proyecto de pruebas) ═══════════════
   OJO: esta es la copia de pruebas. Debe apuntar a un proyecto de Firebase
   DISTINTO al de producción (pedidos-835a1) para que nada de lo que se
   pruebe aquí toque pedidos, usuarios o datos reales.
   Sustituye estos valores por el config del proyecto de pruebas (Firebase
   Console → Configuración del proyecto → tu app web → "Config"). */
const FB_CONFIG = {
  apiKey: "PENDIENTE_CONFIG_STAGING",
  authDomain: "PENDIENTE_CONFIG_STAGING",
  databaseURL: "PENDIENTE_CONFIG_STAGING",
  projectId: "PENDIENTE_CONFIG_STAGING",
  storageBucket: "PENDIENTE_CONFIG_STAGING",
  messagingSenderId: "PENDIENTE_CONFIG_STAGING",
  appId: "PENDIENTE_CONFIG_STAGING"
};
let fbApp, fbDb, fbAuth;
let authUsers = {};
