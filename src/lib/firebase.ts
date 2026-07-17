import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: "AIzaSyCiCCwXAvtrF-W0jcU8RJ3IH6RnpuJlI3c",
  authDomain: "zmam-agency.firebaseapp.com",
  projectId: "zmam-agency",
  storageBucket: "zmam-agency.firebasestorage.app",
  messagingSenderId: "836384581221",
  appId: "1:836384581221:web:929ec741e6b0522230888c"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Secondary app for admin tasks
const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
export const secondaryAuth = getAuth(secondaryApp);
export default app;
