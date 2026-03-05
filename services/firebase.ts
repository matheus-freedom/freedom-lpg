import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // Importamos a ferramenta de arquivos

// Configuração do SEU projeto FreedomLPG
const firebaseConfig = {
  apiKey: "AIzaSyBtyNXcsORnk6zpk5KG4NA2f3uOiq4QrZ0",
  authDomain: "freedom-lpg-88cec.firebaseapp.com",
  projectId: "freedom-lpg-88cec",
  storageBucket: "freedom-lpg-88cec.firebasestorage.app",
  messagingSenderId: "861908062428",
  appId: "1:861908062428:web:100cc41750d9ae0e7e6419"
};

// 1. Inicializa a conexão
const app = initializeApp(firebaseConfig);

// 2. Exporta as ferramentas para usarmos no resto do app
export const auth = getAuth(app);       // Ferramenta de Login
export const db = getFirestore(app);    // Ferramenta do Banco de Dados
export const storage = getStorage(app); // Ferramenta de Arquivos (Imagens)