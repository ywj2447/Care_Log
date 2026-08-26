import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  getDocs,
  setDoc,
  limit
} from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged, User } from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with specific databaseId if provided
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || "(default)");
export const auth = getAuth(app);

// Auth state management helper
let currentUser: User | null = null;
let authInitPromise: Promise<User | null> | null = null;

export const ensureAuth = (): Promise<User | null> => {
  if (currentUser) return Promise.resolve(currentUser);
  if (authInitPromise) return authInitPromise;

  authInitPromise = new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        currentUser = user;
        resolve(user);
      } else {
        try {
          const cred = await signInAnonymously(auth);
          currentUser = cred.user;
          resolve(cred.user);
        } catch (err) {
          console.error("Firebase anonymous sign-in error:", err);
          resolve(null);
        }
      }
    });
  });

  return authInitPromise;
};

export interface SavedLogItem {
  id?: string;
  userId?: string;
  clientName: string;
  date: string;
  type: "생활일지" | "프로그램일지";
  content: string;
  createdAt?: any;
}

// Add a generated log to Firestore
export const saveLogToFirestore = async (logData: {
  clientName: string;
  date: string;
  type: "생활일지" | "프로그램일지";
  content: string;
}): Promise<string | null> => {
  try {
    const user = await ensureAuth();
    if (!user) return null;

    const docRef = await addDoc(collection(db, "care_logs"), {
      userId: user.uid,
      clientName: logData.clientName,
      date: logData.date,
      type: logData.type,
      content: logData.content,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Failed to save log to Firestore:", error);
    return null;
  }
};

// Batch save logs to Firestore
export const batchSaveLogsToFirestore = async (logs: {
  clientName: string;
  date: string;
  type: "생활일지" | "프로그램일지";
  content: string;
}[]): Promise<number> => {
  try {
    const user = await ensureAuth();
    if (!user) return 0;

    let count = 0;
    for (const log of logs) {
      if (log.clientName && log.content) {
        await addDoc(collection(db, "care_logs"), {
          userId: user.uid,
          clientName: log.clientName,
          date: log.date,
          type: log.type,
          content: log.content,
          createdAt: serverTimestamp(),
        });
        count++;
      }
    }
    return count;
  } catch (error) {
    console.error("Failed to batch save logs to Firestore:", error);
    return 0;
  }
};

// Delete a saved log from Firestore
export const deleteLogFromFirestore = async (logId: string): Promise<boolean> => {
  try {
    await deleteDoc(doc(db, "care_logs", logId));
    return true;
  } catch (error) {
    console.error("Failed to delete log from Firestore:", error);
    return false;
  }
};

// Real-time subscription to user's saved logs
export const subscribeToCareLogs = (callback: (logs: SavedLogItem[]) => void) => {
  let unsubscribe: (() => void) | null = null;

  ensureAuth().then((user) => {
    if (!user) {
      callback([]);
      return;
    }

    const q = query(
      collection(db, "care_logs"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(100)
    );

    unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: SavedLogItem[] = [];
        snapshot.forEach((doc) => {
          items.push({
            id: doc.id,
            ...(doc.data() as Omit<SavedLogItem, "id">),
          });
        });
        callback(items);
      },
      (error) => {
        console.error("Care logs subscription error:", error);
      }
    );
  });

  return () => {
    if (unsubscribe) unsubscribe();
  };
};

// Save batch client preset to cloud
export const saveBatchClientsToCloud = async (clients: any[]): Promise<boolean> => {
  try {
    const user = await ensureAuth();
    if (!user) return false;

    await setDoc(doc(db, "batch_presets", user.uid), {
      userId: user.uid,
      clients,
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error("Failed to save batch clients to Firestore:", error);
    return false;
  }
};

// Load batch clients from cloud
export const loadBatchClientsFromCloud = async (): Promise<any[] | null> => {
  try {
    const user = await ensureAuth();
    if (!user) return null;

    const snapshot = await getDocs(query(collection(db, "batch_presets"), where("userId", "==", user.uid)));
    if (!snapshot.empty) {
      const data = snapshot.docs[0].data();
      return data.clients || null;
    }
    return null;
  } catch (error) {
    console.error("Failed to load batch clients from Firestore:", error);
    return null;
  }
};
