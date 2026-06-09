import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as fbSignOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  updateDoc 
} from 'firebase/firestore';

// Fallback configuration using real environment variables if provided
const metaEnv = (import.meta as any).env || {};
const firebaseConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || "AIzaSyDummyKey-ForSandboxUseOnly-123",
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || "pd-manutencao.firebaseapp.com",
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || "pd-manutencao",
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || "pd-manutencao.appspot.com",
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || "12345678",
  appId: metaEnv.VITE_FIREBASE_APP_ID || "1:12345678:web:abcdef"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Data flow synchronization helpers
const syncToFirestoreAndLocal = async (col: string, id: string, data: any, operation: 'set' | 'update' | 'delete') => {
  const localKey = `fs_${col}`;
  let localData: any[] = [];
  try {
    localData = JSON.parse(localStorage.getItem(localKey) || '[]');
  } catch (e) {}

  if (operation === 'set') {
    localData = localData.filter((x: any) => x.id !== id);
    localData.push({ ...data, id });
  } else if (operation === 'update') {
    localData = localData.map((x: any) => x.id === id ? { ...x, ...data } : x);
  } else if (operation === 'delete') {
    localData = localData.filter((x: any) => x.id !== id);
  }
  localStorage.setItem(localKey, JSON.stringify(localData));

  try {
    const docRef = doc(db, col, id);
    if (operation === 'set') {
      await setDoc(docRef, data);
    } else if (operation === 'update') {
      await updateDoc(docRef, data);
    } else if (operation === 'delete') {
      await deleteDoc(docRef);
    }
  } catch (err) {
    console.warn(`[FirebaseSync] Firestore offline fallback for ${col}/${id}:`, err);
  }
};

const fetchColData = async (col: string): Promise<any[]> => {
  const localKey = `fs_${col}`;
  try {
    const querySnapshot = await getDocs(collection(db, col));
    const cloudData: any[] = [];
    querySnapshot.forEach((doc) => {
      cloudData.push({ ...doc.data(), id: doc.id });
    });
    if (cloudData.length > 0) {
      localStorage.setItem(localKey, JSON.stringify(cloudData));
    }
    return cloudData;
  } catch (error) {
    console.warn(`[FirebaseSync] Firestore fetch failed for ${col}. Loading from offline-first cache:`, error);
    try {
      return JSON.parse(localStorage.getItem(localKey) || '[]');
    } catch (e) {
      return [];
    }
  }
};

// Seed default initial app data if missing
const seedInitialDataIfNeeded = () => {
  const seeds = {
    brands: [
      { id: 'b1', name: 'Toyota', created_at: new Date().toISOString() },
      { id: 'b2', name: 'Hyster', created_at: new Date().toISOString() },
      { id: 'b3', name: 'Still', created_at: new Date().toISOString() },
      { id: 'b4', name: 'Yale', created_at: new Date().toISOString() }
    ],
    models: [
      { id: 'm1', brand_id: 'b1', name: 'Toyota 8FGU25', created_at: new Date().toISOString() },
      { id: 'm2', brand_id: 'b2', name: 'Hyster H50FT', created_at: new Date().toISOString() },
      { id: 'm3', brand_id: 'b3', name: 'Still RC40', created_at: new Date().toISOString() }
    ],
    battery_types: [
      { id: 'bt1', name: 'Chumbo-Ácido', created_at: new Date().toISOString() },
      { id: 'bt2', name: 'Íon de Lítio', created_at: new Date().toISOString() },
      { id: 'bt3', name: 'Gel', created_at: new Date().toISOString() }
    ],
    charger_types: [
      { id: 'ct1', name: 'Trifásico 48V', created_at: new Date().toISOString() },
      { id: 'ct2', name: 'Monofásico 24V', created_at: new Date().toISOString() },
      { id: 'ct3', name: 'Carregador Celular', created_at: new Date().toISOString() }
    ],
    preventive_checklist_items: [
      { id: 'chk1', label: 'Verificação do nível de óleo do motor', display_order: 1, is_active: true, created_at: new Date().toISOString() },
      { id: 'chk2', label: 'Verificação do nível de óleo hidráulico', display_order: 2, is_active: true, created_at: new Date().toISOString() },
      { id: 'chk3', label: 'Verificação do nível da água do radiador', display_order: 3, is_active: true, created_at: new Date().toISOString() },
      { id: 'chk4', label: 'Lubrificação de mastro e correntes', display_order: 4, is_active: true, created_at: new Date().toISOString() },
      { id: 'chk5', label: 'Verificação das palhetas de borracha dos garfos', display_order: 5, is_active: true, created_at: new Date().toISOString() },
      { id: 'chk6', label: 'Verificação e limpeza do filtro de ar', display_order: 6, is_active: true, created_at: new Date().toISOString() },
      { id: 'chk7', label: 'Verificação do sistema de freios', display_order: 7, is_active: true, created_at: new Date().toISOString() },
      { id: 'chk8', label: 'Verificação do sistema elétrico (fusíveis e cabos)', display_order: 8, is_active: true, created_at: new Date().toISOString() },
      { id: 'chk9', label: 'Teste de funcionamento do buzzer e sinalizações', display_order: 9, is_active: true, created_at: new Date().toISOString() },
      { id: 'chk10', label: 'Verificação do estado e calibragem dos pneus', display_order: 10, is_active: true, created_at: new Date().toISOString() }
    ],
    customers: [
      {
        id: 'c1',
        name: 'Logística Expressa S.A.',
        tax_id: '12.345.678/0001-99',
        contact_email: 'raoniespin@gmail.com',
        phone: '(11) 98765-4321',
        whatsapp: '(11) 98765-4321',
        terms_accepted: true,
        created_at: new Date().toISOString()
      },
      {
        id: 'c2',
        name: 'Supermercado Progresso',
        tax_id: '98.765.432/0001-11',
        contact_email: 'cliente@progresso.com',
        phone: '(11) 91234-5678',
        whatsapp: '(11) 91234-5678',
        terms_accepted: true,
        created_at: new Date().toISOString()
      }
    ],
    machines: [
      {
        id: 'mac1',
        customer_id: 'c1',
        brand: 'Toyota',
        model: 'Toyota 8FGU25',
        serial_number: 'TY8F25-100234',
        internal_id: 'TY-01',
        mfg_year: 2021,
        energy_type: 'GLP',
        load_capacity_tons: 2.5,
        mast_type: 'Triplex',
        max_elevation_meters: 4.8,
        current_hour_meter: 1240.5,
        daily_usage_avg_hours: 6.5,
        status: 'OPERACIONAL',
        created_at: new Date().toISOString()
      }
    ],
    profiles: []
  };

  Object.entries(seeds).forEach(([col, items]) => {
    const key = `fs_${col}`;
    if (!localStorage.getItem(key) || JSON.parse(localStorage.getItem(key) || '[]').length === 0) {
      localStorage.setItem(key, JSON.stringify(items));
      items.forEach(async (item: any) => {
        try {
          await setDoc(doc(db, col, item.id), item);
        } catch (e) {}
      });
    }
  });
};

setTimeout(seedInitialDataIfNeeded, 500);

class QueryBuilder {
  private col: string;
  private filters: Array<{ field: string; op: string; value: any }> = [];
  private orderByFields: Array<{ field: string; ascending: boolean }> = [];
  private limitVal: number | null = null;
  private countVal: boolean = false;

  private pendingAction: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private pendingPayload: any = null;

  constructor(col: string) {
    this.col = col;
  }

  select(fields?: string, opts?: { count?: string; head?: boolean }) {
    this.pendingAction = 'select';
    if (opts?.count) {
      this.countVal = true;
    }
    return this;
  }

  eq(field: string, value: any) {
    this.filters.push({ field, op: '==', value });
    return this;
  }

  neq(field: string, value: any) {
    this.filters.push({ field, op: '!=', value });
    return this;
  }

  in(field: string, values: any[]) {
    this.filters.push({ field, op: 'in', value: values });
    return this;
  }

  gte(field: string, value: any) {
    this.filters.push({ field, op: '>=', value });
    return this;
  }

  lte(field: string, value: any) {
    this.filters.push({ field, op: '<=', value });
    return this;
  }

  order(field: string, opts?: { ascending?: boolean }) {
    this.orderByFields.push({ field, ascending: opts?.ascending !== false });
    return this;
  }

  limit(n: number) {
    this.limitVal = n;
    return this;
  }

  insert(rows: any | any[]) {
    this.pendingAction = 'insert';
    this.pendingPayload = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  update(changes: any) {
    this.pendingAction = 'update';
    this.pendingPayload = changes;
    return this;
  }

  delete() {
    this.pendingAction = 'delete';
    return this;
  }

  upsert(rows: any | any[], opts?: any) {
    this.pendingAction = 'upsert';
    this.pendingPayload = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  async single() {
    const res = await this.execute();
    return { data: res.data && res.data.length > 0 ? res.data[0] : null, error: res.error };
  }

  then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute() {
    try {
      if (this.pendingAction === 'insert') {
        const results: any[] = [];
        for (const row of this.pendingPayload) {
          const id = row.id || doc(collection(db, this.col)).id;
          const completeRow = {
            ...row,
            id,
            created_at: row.created_at || new Date().toISOString()
          };
          await syncToFirestoreAndLocal(this.col, id, completeRow, 'set');
          results.push(completeRow);
        }
        return { data: results, error: null };
      }

      if (this.pendingAction === 'upsert') {
        const results: any[] = [];
        for (const row of this.pendingPayload) {
          let id = row.id;
          if (!id) {
            if (this.col === 'admin_settings' && row.key) {
              id = row.key;
            } else {
              id = doc(collection(db, this.col)).id;
            }
          }
          const completeRow = {
            ...row,
            id,
            updated_at: new Date().toISOString()
          };
          await syncToFirestoreAndLocal(this.col, id, completeRow, 'set');
          results.push(completeRow);
        }
        return { data: results, error: null };
      }

      let data = await fetchColData(this.col);

      // Apply In-Memory Filters (Zero Index requirement problems, absolute stability)
      for (const filter of this.filters) {
        data = data.filter((row: any) => {
          let val = row[filter.field];
          if (filter.op === '==') {
            return String(val ?? '').toLowerCase() === String(filter.value ?? '').toLowerCase();
          }
          if (filter.op === '!=') {
            return String(val ?? '').toLowerCase() !== String(filter.value ?? '').toLowerCase();
          }
          if (filter.op === 'in') {
            if (!Array.isArray(filter.value)) return false;
            return filter.value.some((v: any) => String(v ?? '').toLowerCase() === String(val ?? '').toLowerCase());
          }
          if (filter.op === '>=') {
            if (val == null || filter.value == null) return false;
            return val >= filter.value;
          }
          if (filter.op === '<=') {
            if (val == null || filter.value == null) return false;
            return val <= filter.value;
          }
          return true;
        });
      }

      if (this.pendingAction === 'update') {
        const updatedRows: any[] = [];
        for (const row of data) {
          const completeChanges = {
            ...row,
            ...this.pendingPayload,
            updated_at: new Date().toISOString()
          };
          await syncToFirestoreAndLocal(this.col, row.id, completeChanges, 'set');
          updatedRows.push(completeChanges);
        }
        return { data: updatedRows, error: null };
      }

      if (this.pendingAction === 'delete') {
        for (const row of data) {
          await syncToFirestoreAndLocal(this.col, row.id, null, 'delete');
        }
        return { data: data, error: null };
      }

      // Default: 'select'
      // Apply orders
      for (const ord of this.orderByFields) {
        data.sort((a: any, b: any) => {
          const valA = a[ord.field];
          const valB = b[ord.field];
          if (valA === valB) return 0;
          if (valA == null) return 1;
          if (valB == null) return -1;
          const comp = valA > valB ? 1 : -1;
          return ord.ascending ? comp : -comp;
        });
      }

      // Apply limit
      if (this.limitVal !== null) {
        data = data.slice(0, this.limitVal);
      }

      return {
        data,
        count: data.length,
        error: null
      };
    } catch (err: any) {
      return { data: [], count: 0, error: err };
    }
  }
}

const storageChannels = {
  from(bucketName: string) {
    return {
      async upload(fileName: string, file: File) {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64data = reader.result as string;
            localStorage.setItem(`storage_${bucketName}_${fileName}`, base64data);
            resolve({ data: { path: fileName }, error: null });
          };
          reader.onerror = () => {
            resolve({ data: null, error: new Error("File reading failed") });
          };
          reader.readAsDataURL(file);
        });
      },
      getPublicUrl(fileName: string) {
        const cached = localStorage.getItem(`storage_${bucketName}_${fileName}`);
        return {
          data: {
            publicUrl: cached || "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&q=80&w=400"
          }
        };
      },
      async remove(paths: string[]) {
        paths.forEach(p => {
          localStorage.removeItem(`storage_${bucketName}_${p}`);
        });
        return { data: true, error: null };
      }
    };
  }
};

const normalizeUser = (fbUser: any) => {
  if (!fbUser) return null;
  return {
    id: fbUser.uid,
    uid: fbUser.uid,
    email: fbUser.email,
    user_metadata: {
      full_name: fbUser.displayName || fbUser.email?.split('@')[0],
      role: 'Customer'
    }
  };
};

export const supabase = {
  from(colName: string) {
    return new QueryBuilder(colName);
  },
  storage: storageChannels,
  auth: {
    async getSession() {
      const fbUser = auth.currentUser;
      return {
        data: {
          session: fbUser ? { user: normalizeUser(fbUser) } : null
        },
        error: null
      };
    },
    async signInWithPassword({ email, password }: any) {
      try {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        return {
          data: { user: normalizeUser(credential.user) },
          error: null
        };
      } catch (err: any) {
        return { data: { user: null }, error: err };
      }
    },
    async signUp({ email, password, options }: any) {
      try {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        const user = credential.user;
        
        let role = 'Customer';
        let is_approved = false;
        const emailLower = email.toLowerCase();
        
        if (['raoniespin@gmail.com', 'raopniespin@gmail.com', 'espin.mais@gmail.com'].includes(emailLower)) {
          role = 'Admin';
          is_approved = true;
        }

        const userProfile = {
          id: user.uid,
          full_name: options?.data?.full_name || email.split('@')[0],
          email: email,
          role: role,
          is_approved: is_approved,
          avatar_url: null,
          created_at: new Date().toISOString()
        };

        // Sync profile
        await syncToFirestoreAndLocal('profiles', user.uid, userProfile, 'set');

        return {
          data: { user: normalizeUser(user) },
          error: null
        };
      } catch (err: any) {
        return { data: { user: null }, error: err };
      }
    },
    async signOut() {
      await fbSignOut(auth);
      return { error: null };
    },
    onAuthStateChange(callback: (event: string, session: any) => void) {
      const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
        const session = fbUser ? { user: normalizeUser(fbUser) } : null;
        callback('SIGNED_IN_OR_OUT', session);
      });
      return {
        data: {
          subscription: {
            unsubscribe
          }
        }
      };
    }
  }
};
