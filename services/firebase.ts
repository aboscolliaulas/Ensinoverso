
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc,
  query,
  where,
  onSnapshot,
  getDoc
} from "firebase/firestore";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from "firebase/auth";

/**
 * ATENÇÃO: ERRO DE PERMISSÕES (Missing or insufficient permissions)
 * Para resolver este erro, copie as regras abaixo e cole na aba "Rules" do seu Firestore no Console do Firebase:
 * 
 * rules_version = '2';
 * service cloud.firestore {
 *   match /databases/{database}/documents {
 *     // Permite que qualquer usuário autenticado leia e escreva seu próprio perfil
 *     match /users/{userId} {
 *       allow read, write: if request.auth != null && request.auth.uid == userId;
 *       // Permite que administradores vejam todos os usuários
 *       allow list: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'administrador';
 *     }
 *     
 *     // Permite leitura para usuários autenticados, escrita apenas para Admins ou donos
 *     match /bncc/{id} {
 *       allow read: if request.auth != null;
 *       allow write: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'administrador';
 *     }
 *     
 *     match /classes/{id} {
 *       allow read: if request.auth != null;
 *       allow write: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'administrador';
 *     }
 *     
 *     match /lessons/{id} {
 *       allow read: if request.auth != null;
 *       allow write: if request.auth != null && (
 *         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'administrador' ||
 *         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'professor'
 *       );
 *     }
 *   }
 * }
 */

const firebaseConfig = {
  apiKey: "AIzaSyCmbrUtoTUvi0xpj9fgH3A7tovYyBzAJC0",
  authDomain: "ensinoverso-d10ef.firebaseapp.com",
  projectId: "ensinoverso-d10ef",
  storageBucket: "ensinoverso-d10ef.firebasestorage.app",
  messagingSenderId: "817050882512",
  appId: "1:817050882512:web:283335b247a66281c0e9d5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export const authService = {
  signUp: async (email: string, pass: string) => {
    return await createUserWithEmailAndPassword(auth, email, pass);
  },
  signIn: async (email: string, pass: string) => {
    return await signInWithEmailAndPassword(auth, email, pass);
  },
  signOut: async () => {
    return await firebaseSignOut(auth);
  },
  onAuthChange: (callback: (user: FirebaseUser | null) => void) => {
    return onAuthStateChanged(auth, callback);
  }
};

export const dbService = {
  getCollection: async <T>(collectionName: string): Promise<T[]> => {
    try {
      const querySnapshot = await getDocs(collection(db, collectionName));
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
    } catch (error) {
      console.error(`Erro ao buscar coleção ${collectionName}:`, error);
      return [];
    }
  },
  
  getById: async <T>(collectionName: string, id: string): Promise<T | null> => {
    try {
      const docSnap = await getDoc(doc(db, collectionName, id));
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as T;
      }
    } catch (error) {
      console.error(`Erro ao buscar documento ${id} em ${collectionName}:`, error);
    }
    return null;
  },

  add: async (collectionName: string, data: any) => {
    return await addDoc(collection(db, collectionName), data);
  },

  save: async (collectionName: string, id: string, data: any) => {
    return await setDoc(doc(db, collectionName, id), data, { merge: true });
  },

  update: async (collectionName: string, id: string, data: any) => {
    return await updateDoc(doc(db, collectionName, id), data);
  },

  delete: async (collectionName: string, id: string) => {
    return await deleteDoc(doc(db, collectionName, id));
  },

  subscribe: (collectionName: string, callback: (data: any[]) => void) => {
    return onSnapshot(collection(db, collectionName), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    }, (error) => {
      console.error(`Erro na subscrição da coleção ${collectionName}:`, error);
    });
  }
};

export { db, auth };
