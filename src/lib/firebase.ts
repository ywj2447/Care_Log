import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  query, 
  onSnapshot, 
  serverTimestamp, 
  getDocs, 
  setDoc, 
  getDoc,
  getDocFromServer,
  limit 
} from "firebase/firestore";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  browserLocalPersistence, 
  setPersistence,
  User 
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

// Environment variable overrides with fallback to firebase-applet-config.json
const env = (import.meta as any).env || {};

export const firebaseOptions = {
  apiKey: env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || (env.VITE_FIREBASE_PROJECT_ID ? `${env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com` : firebaseConfig.authDomain),
  projectId: env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId || "carelog-dfd39",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || (env.VITE_FIREBASE_PROJECT_ID ? `${env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app` : firebaseConfig.storageBucket),
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
  appId: env.VITE_FIREBASE_APP_ID || firebaseConfig.appId,
};

// Initialize Firebase App instance
export const app = getApps().length === 0 ? initializeApp(firebaseOptions) : getApp();

// Initialize Firestore strictly using the standard default database `(default)`
// Calling getFirestore(app) connects directly to standard (default) database in Firebase project
export const db = getFirestore(app);

// Initialize Authentication using the EXACT SAME Firebase App instance
export const auth = getAuth(app);

// Ensure local persistence for seamless page reload and return sessions
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn("Firebase Auth persistence configuration warning:", err);
});

// Google Auth Provider setup
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// Error handling specification
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Optional background connection test probe
async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.warn("Firebase notice: client is offline.");
    }
  }
}
testConnection();

// Authentication Helpers
export const signInWithGoogle = async (): Promise<User | null> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    if (
      error?.code === "auth/popup-closed-by-user" || 
      error?.code === "auth/cancelled-popup-request"
    ) {
      console.log("Google sign-in popup was dismissed by user.");
      return null;
    }

    if (error?.code === "auth/unauthorized-domain") {
      console.warn("Firebase Auth: Current domain requires registration under Authorized Domains in Firebase Console.", {
        domain: typeof window !== "undefined" ? window.location.hostname : "",
        projectId: firebaseConfig.projectId,
      });
      const customErr: any = new Error("FIREBASE_AUTH_UNAUTHORIZED_DOMAIN");
      customErr.code = "auth/unauthorized-domain";
      customErr.domain = typeof window !== "undefined" ? window.location.hostname : "";
      customErr.projectId = firebaseConfig.projectId;
      throw customErr;
    }

    console.warn("Google Sign-In notice:", error?.message || error);
    throw error;
  }
};

export const logoutUser = async (): Promise<void> => {
  await signOut(auth);
};

export const subscribeToAuthState = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

// Data Models
export interface SavedLogItem {
  id?: string;
  userId: string;
  clientName: string;
  date: string;
  type: "생활일지" | "프로그램일지";
  content: string;
  inputs?: any;
  createdAt?: any;
  updatedAt?: any;
}

export interface CareDraft {
  userId: string;
  name: string;
  date: string;
  type: "생활일지" | "프로그램일지";
  transit?: string;
  hygiene?: string;
  diet?: string;
  health?: string;
  program?: string;
  others?: string;
  programName?: string;
  observation?: string;
  support?: string;
  reaction?: string;
  plan?: string;
  isBatchMode?: boolean;
  batchClients?: any[];
  result?: string;
  updatedAt?: any;
}

// 1. Add a generated log to user's isolated records (/users/{uid}/records)
export const saveLogToFirestore = async (logData: {
  clientName: string;
  date: string;
  type: "생활일지" | "프로그램일지";
  content: string;
  inputs?: any;
}): Promise<string | null> => {
  const user = auth.currentUser;
  if (!user) {
    console.warn("saveLogToFirestore called without authenticated user.");
    return null;
  }

  const path = `users/${user.uid}/records`;
  try {
    const docRef = await addDoc(collection(db, "users", user.uid, "records"), {
      userId: user.uid,
      clientName: logData.clientName,
      date: logData.date,
      type: logData.type,
      content: logData.content,
      inputs: logData.inputs || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

// 2. Batch save logs to user's isolated records (/users/{uid}/records)
export const batchSaveLogsToFirestore = async (logs: {
  clientName: string;
  date: string;
  type: "생활일지" | "프로그램일지";
  content: string;
  inputs?: any;
}[]): Promise<number> => {
  const user = auth.currentUser;
  if (!user) {
    console.warn("batchSaveLogsToFirestore called without authenticated user.");
    return 0;
  }

  const path = `users/${user.uid}/records`;
  let count = 0;
  try {
    for (const log of logs) {
      if (log.clientName && log.content) {
        await addDoc(collection(db, "users", user.uid, "records"), {
          userId: user.uid,
          clientName: log.clientName,
          date: log.date,
          type: log.type,
          content: log.content,
          inputs: log.inputs || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        count++;
      }
    }
    return count;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

// 3. Delete a saved log from user's isolated records
export const deleteLogFromFirestore = async (logId: string): Promise<boolean> => {
  const user = auth.currentUser;
  if (!user) return false;

  const path = `users/${user.uid}/records/${logId}`;
  try {
    await deleteDoc(doc(db, "users", user.uid, "records", logId));
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

// 4. Delete multiple logs from user's isolated records
export const deleteMultipleLogsFromFirestore = async (logIds: string[]): Promise<number> => {
  const user = auth.currentUser;
  if (!user) return 0;

  let deletedCount = 0;
  for (const id of logIds) {
    if (id) {
      const path = `users/${user.uid}/records/${id}`;
      try {
        await deleteDoc(doc(db, "users", user.uid, "records", id));
        deletedCount++;
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    }
  }
  return deletedCount;
};

// 5. Delete all logs from user's isolated records
export const deleteAllLogsFromFirestore = async (): Promise<boolean> => {
  const user = auth.currentUser;
  if (!user) return false;

  const path = `users/${user.uid}/records`;
  try {
    const snapshot = await getDocs(collection(db, "users", user.uid, "records"));
    for (const docSnap of snapshot.docs) {
      await deleteDoc(doc(db, "users", user.uid, "records", docSnap.id));
    }
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

// 6. Real-time subscription to user's isolated care logs
export const subscribeToCareLogs = (
  callback: (logs: SavedLogItem[]) => void,
  onStatusChange?: (status: "connected" | "error" | "disconnected") => void
) => {
  let unsubscribeSnapshot: (() => void) | null = null;

  const updateListener = (user: User | null) => {
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }

    if (!user) {
      callback([]);
      if (onStatusChange) onStatusChange("disconnected");
      return;
    }

    const path = `users/${user.uid}/records`;
    try {
      const q = query(
        collection(db, "users", user.uid, "records"),
        limit(200)
      );

      unsubscribeSnapshot = onSnapshot(
        q,
        (snapshot) => {
          const items: SavedLogItem[] = [];
          snapshot.forEach((docSnap) => {
            items.push({
              id: docSnap.id,
              ...(docSnap.data() as Omit<SavedLogItem, "id">),
            });
          });
          // Sort descending by creation timestamp in memory
          items.sort((a, b) => {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA;
          });
          callback(items);
          if (onStatusChange) onStatusChange("connected");
        },
        (error) => {
          if (onStatusChange) onStatusChange("error");
          console.warn("Firestore subscription notice:", error?.message || error);
        }
      );
    } catch (e) {
      if (onStatusChange) onStatusChange("error");
      console.warn("Firestore subscription init notice:", e);
    }
  };

  const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
    updateListener(user);
  });

  return () => {
    if (unsubscribeSnapshot) unsubscribeSnapshot();
    unsubscribeAuth();
  };
};

// 7. Save batch client preset to user's isolated storage
export const saveBatchClientsToCloud = async (clients: any[]): Promise<boolean> => {
  const user = auth.currentUser;
  if (!user) return false;

  const path = `users/${user.uid}/batch_presets/default`;
  try {
    await setDoc(doc(db, "users", user.uid, "batch_presets", "default"), {
      userId: user.uid,
      name: "default",
      clients,
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

// 8. Load batch client preset from user's isolated storage
export const loadBatchClientsFromCloud = async (): Promise<any[] | null> => {
  const user = auth.currentUser;
  if (!user) return null;

  const path = `users/${user.uid}/batch_presets/default`;
  try {
    const docSnap = await getDoc(doc(db, "users", user.uid, "batch_presets", "default"));
    if (docSnap.exists()) {
      const data = docSnap.data();
      return data.clients || null;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
};

// 9. Auto-save current working draft (/users/{uid}/draft/current)
export const saveDraftToCloud = async (draftData: Omit<CareDraft, "userId" | "updatedAt">): Promise<boolean> => {
  const user = auth.currentUser;
  if (!user) return false;

  const path = `users/${user.uid}/draft/current`;
  try {
    await setDoc(doc(db, "users", user.uid, "draft", "current"), {
      ...draftData,
      userId: user.uid,
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

// 10. Load current working draft from cloud (/users/{uid}/draft/current)
export const loadDraftFromCloud = async (): Promise<CareDraft | null> => {
  const user = auth.currentUser;
  if (!user) return null;

  const path = `users/${user.uid}/draft/current`;
  try {
    const docSnap = await getDoc(doc(db, "users", user.uid, "draft", "current"));
    if (docSnap.exists()) {
      return docSnap.data() as CareDraft;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
};
