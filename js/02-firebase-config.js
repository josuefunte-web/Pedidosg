/* ═══════════════ FIREBASE CONFIG (RAMA DE PRUEBAS / CLON) ═══════════════
   Esta rama usa un proyecto de Firebase SEPARADO del de producción para
   que las pruebas no toquen los datos ni los usuarios reales.
   Sustituye los valores de abajo por los del proyecto de pruebas que
   crees en https://console.firebase.google.com (ver guía en el chat). */
const FB_CONFIG = {
  apiKey: "REEMPLAZA_CON_TU_TEST_API_KEY",
  authDomain: "REEMPLAZA.firebaseapp.com",
  databaseURL: "https://REEMPLAZA-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "REEMPLAZA",
  storageBucket: "REEMPLAZA.firebasestorage.app",
  messagingSenderId: "REEMPLAZA",
  appId: "REEMPLAZA"
};
let fbApp, fbDb, fbAuth;
let authUsers = {};
