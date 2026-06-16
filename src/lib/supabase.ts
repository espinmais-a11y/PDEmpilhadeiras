/// <reference types="vite/client" />
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
  updateDoc,
  getDoc
} from 'firebase/firestore';

// Fallback configuration using real environment variables if provided
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDummyKey-ForSandboxUseOnly-123",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "pd-manutencao.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "pd-manutencao",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "pd-manutencao.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "12345678",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:12345678:web:abcdef"
};

const isDummyConfig = !import.meta.env.VITE_FIREBASE_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY.includes('DummyKey');

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
  } catch (err: any) {
    console.error(`[FirebaseSync] Firestore write failed for ${col}/${id}:`, err);
    if (!isDummyConfig) {
      if (col === 'admin_settings') {
        console.warn(`[FirebaseSync] Sourcing fallback local for admin_settings due to cloud sync restrictions.`);
        return;
      }
      console.warn(`[FirebaseSync] Sourcing offline-first local fallback for write in ${col}/${id} due to cloud restriction or connection failure.`);
    }
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
      let localCache: any[] = [];
      try {
        localCache = JSON.parse(localStorage.getItem(localKey) || '[]');
      } catch (e) {}

      const cloudIds = new Set(cloudData.map((x: any) => x.id));
      const localOnly = localCache.filter((x: any) => x && x.id && !cloudIds.has(x.id));

      const merged = [...cloudData, ...localOnly];
      localStorage.setItem(localKey, JSON.stringify(merged));
      return merged;
    } else {
      // Se a nuvem estiver vazia, tenta retornar caches locais (como sementes/offline) e sincronizá-los
      let localCache: any[] = [];
      try {
        localCache = JSON.parse(localStorage.getItem(localKey) || '[]');
      } catch (e) {}
      if (localCache.length > 0) {
        localCache.forEach(async (item: any) => {
          try {
            await setDoc(doc(db, col, item.id), item);
          } catch (e) {}
        });
        return localCache;
      }
      return [];
    }
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
      { id: 'chk_p20_01', label: '01. Foto da frente do equipamento realizada?', display_order: 1, part: '📷 Registro Fotográfico Inicial', is_active: true, created_at: new Date().toISOString() },
      { id: 'chk_p20_02', label: '02. Foto da esquerda do equipamento realizada?', display_order: 2, part: '📷 Registro Fotográfico Inicial', is_active: true, created_at: new Date().toISOString() },
      { id: 'chk_p20_03', label: '03. Foto da direita do equipamento realizada?', display_order: 3, part: '📷 Registro Fotográfico Inicial', is_active: true, created_at: new Date().toISOString() },
      { id: 'chk_p20_04', label: '04. Foto da traseira do equipamento realizada?', display_order: 4, part: '📷 Registro Fotográfico Inicial', is_active: true, created_at: new Date().toISOString() },
      { id: 'chk_p20_05', label: '05. A carcaça, chassi ou estrutura externa está livre de trincas, amassados ou pontos de corrosão?', display_order: 5, part: '🔍 Estrutura e Aspecto Visual', is_active: true, created_at: new Date().toISOString() },
      { id: 'chk_p20_06', label: '06. Os painéis de proteção e tampas estão fixados corretamente e com os parafusos apertados?', display_order: 6, part: '🔍 Estrutura e Aspecto Visual', is_active: true, created_at: new Date().toISOString() },
      { id: 'chk_p20_07', label: '07. Há presença de vazamentos visíveis (óleo, fluido hidráulico, água ou combustível) embaixo ou no corpo do equipamento?', display_order: 7, part: '🔍 Estrutura e Aspecto Visual', is_active: true, created_at: new Date().toISOString() },
      { id: 'chk_p20_08', label: '08. O equipamento encontra-se limpo, livre de excesso de poeira, graxa ou resíduos que possam obstruir a operação?', display_order: 8, part: '🔍 Estrutura e Aspecto Visual', is_active: true, created_at: new Date().toISOString() },
      { id: 'chk_p20_09', label: '09. Os cabos elétricos e chicotes estão em bom estado, sem fios expostos, ressecados ou desencapados?', display_order: 9, part: '⚡ Sistema Elétrico e Cabeamento', is_active: true, created_at: new Date().toISOString() },
      { id: 'chk_p20_10', label: '10. As conexões elétricas e plugues estão firmes e sem sinais de superaquecimento ou oxidação?', display_order: 10, part: '⚡ Sistema Elétrico e Cabeamento', is_active: true, created_at: new Date().toISOString() },
      { id: 'chk_p20_11', label: '11. Os botões de comando, chaves seletores e telas de interface estão operando e respondendo corretamente?', display_order: 11, part: '⚡ Sistema Elétrico e Cabeamento', is_active: true, created_at: new Date().toISOString() },
      { id: 'chk_p20_12', label: '12. O botão de Parada de Emergência está visível, desobstruído e funcionando perfeitamente?', display_order: 12, part: '⚡ Sistema Elétrico e Cabeamento', is_active: true, created_at: new Date().toISOString() },
      { id: 'chk_p20_13', label: '13. Os pontos de articulação, rolamentos ou guias estão devidamente lubrificados?', display_order: 13, part: '⚙️ Componentes Mecânicos e Desgaste', is_active: true, created_at: new Date().toISOString() },
      { id: 'chk_p20_14', label: '14. Há algum ruído ou vibração anormal durante a inicialização ou movimentação do equipamento?', display_order: 14, part: '⚙️ Componentes Mecânicos e Desgaste', is_active: true, created_at: new Date().toISOString() },
      { id: 'chk_p20_15', label: '15. Os elementos de fixação (porcas, parafusos, presilhas) estão completos e devidamente torcidos?', display_order: 15, part: '⚙️ Componentes Mecânicos e Desgaste', is_active: true, created_at: new Date().toISOString() },
      { id: 'chk_p20_16', label: '16. As correias, correntes ou polias apresentam tensão correta e estão livres de desgaste excessivo?', display_order: 16, part: '⚙️ Componentes Mecânicos e Desgaste', is_active: true, created_at: new Date().toISOString() },
      { id: 'chk_p20_17', label: '17. As etiquetas de aviso, placas de identificação e adesivos de segurança estão colados e legíveis?', display_order: 17, part: '⚠️ Segurança, Sinalização e Organização', is_active: true, created_at: new Date().toISOString() },
      { id: 'chk_p20_18', label: '18. Os sistemas de iluminação (se houver), girofles ou alarmes sonoros estão ativos e operantes?', display_order: 18, part: '⚠️ Segurança, Sinalização e Organização', is_active: true, created_at: new Date().toISOString() },
      { id: 'chk_p20_19', label: '19. O local ao redor do equipamento está limpo, organizado e com os acessos desobstruídos?', display_order: 19, part: '⚠️ Segurança, Sinalização e Organização', is_active: true, created_at: new Date().toISOString() },
      { id: 'chk_p20_20', label: '20. O equipamento foi testado e está liberado para operação segura?', display_order: 20, part: '⚠️ Segurança, Sinalização e Organização', is_active: true, created_at: new Date().toISOString() }
    ],
    customers: [
      {
        id: 'c-pd',
        name: 'PD Empilhadeiras',
        tax_id: '00.000.000/0001-00',
        contact_email: 'contato@pdempilhadeiras.com.br',
        phone: '(11) 5555-5555',
        whatsapp: '(11) 95555-5555',
        terms_accepted: true,
        created_at: new Date().toISOString()
      },
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
    inventory: [
      {
        id: 'i1',
        code: 'FIL-H10',
        name: 'Filtro de Retorno Hidráulico Hyster',
        category: 'Filtros',
        location: 'Recebimento - 10500',
        quantity: 15,
        unit_price: 135.00,
        min_stock: 5,
        created_at: new Date().toISOString()
      },
      {
        id: 'i2',
        code: 'PNE-SUP10',
        name: 'Pneu Maciço Superelástico 6.50-10 Yale',
        category: 'Pneus',
        location: 'Recebimento - 10500',
        quantity: 4,
        unit_price: 850.00,
        min_stock: 2,
        created_at: new Date().toISOString()
      },
      {
        id: 'i3',
        code: 'VET-P8',
        name: 'Vedação do Mastro Toyota 8FGU25',
        category: 'Vedação',
        location: 'Recebimento - 10500',
        quantity: 42,
        unit_price: 18.50,
        min_stock: 10,
        created_at: new Date().toISOString()
      },
      {
        id: 'i4',
        code: 'OLE-10W30',
        name: 'Óleo de Motor 10W30 (Litro)',
        category: 'Lubrificantes',
        location: 'Estoque Geral',
        quantity: 120,
        unit_price: 35.00,
        min_stock: 20,
        created_at: new Date().toISOString()
      },
      {
        id: 'i5',
        code: 'ALT-T8',
        name: 'Alternador Toyota 12V',
        category: 'Elétrica',
        location: 'Penal',
        quantity: 2,
        unit_price: 1100.00,
        min_stock: 1,
        created_at: new Date().toISOString()
      },
      {
        id: 'i6',
        code: 'COR-M3',
        name: 'Corrente do Mastro Duplex',
        category: 'Mastro',
        location: 'Penal',
        quantity: 3,
        unit_price: 420.00,
        min_stock: 2,
        created_at: new Date().toISOString()
      }
    ],
    inventory_history: [
      {
        id: 'h1',
        item_id: 'i1',
        item_code: 'FIL-H10',
        item_name: 'Filtro de Retorno Hidráulico Hyster',
        type: 'entrada',
        quantity: 15,
        reason: 'Origem: Furo de estoque da Penal (Erro PCP)',
        location: 'Recebimento - 10500',
        user_name: 'SISTEMA (PCP)',
        created_at: new Date(Date.now() - 3600000 * 24).toISOString()
      },
      {
        id: 'h2',
        item_id: 'i2',
        item_code: 'PNE-SUP10',
        item_name: 'Pneu Maciço Superelástico 6.50-10 Yale',
        type: 'entrada',
        quantity: 4,
        reason: 'Origem: Furo de estoque da Penal (Erro PCP)',
        location: 'Recebimento - 10500',
        user_name: 'SISTEMA (PCP)',
        created_at: new Date(Date.now() - 3600000 * 24).toISOString()
      },
      {
        id: 'h3',
        item_id: 'i3',
        item_code: 'VET-P8',
        item_name: 'Vedação do Mastro Toyota 8FGU25',
        type: 'entrada',
        quantity: 42,
        reason: 'Origem: Furo de estoque da Penal (Erro PCP)',
        location: 'Recebimento - 10500',
        user_name: 'SISTEMA (PCP)',
        created_at: new Date(Date.now() - 3600000 * 24).toISOString()
      }
    ],
    inventory_entries: [
      {
        id: 'ent-1',
        date: '2026-06-05',
        supplier: 'DISTRIBUIDORA PEÇAS INDUSTRIAL S.A.',
        item_code: 'FIL-H10',
        item_name: 'Filtro de Retorno Hidráulico Hyster',
        quantity: 10,
        invoice_number: 'NF-10254',
        user_name: 'RAONIESPIN',
        created_at: new Date(Date.now() - 3600000 * 24 * 3).toISOString()
      },
      {
        id: 'ent-2',
        date: '2026-06-08',
        supplier: 'IMPORTS INDUSTRIAL LTDA',
        item_code: 'PNE-SUP10',
        item_name: 'Pneu Maciço Superelástico 6.50-10 Yale',
        quantity: 4,
        invoice_number: 'NF-50493',
        user_name: 'RAONIESPIN',
        created_at: new Date(Date.now() - 3600000 * 24).toISOString()
      }
    ],
    profiles: [],
    suppliers: [
      { id: 's1', name: 'DISTRIBUIDORA PEÇAS INDUSTRIAL S.A.', tax_id: '11.222.333/0001-44', phone: '(11) 2222-3333', contact_email: 'vendas@distribuidoraparts.com.br', created_at: new Date().toISOString() },
      { id: 's2', name: 'IMPORTS INDUSTRIAL LTDA', tax_id: '22.333.444/0001-55', phone: '(11) 3333-4444', contact_email: 'contato@importsindustrial.com.br', created_at: new Date().toISOString() }
    ]
  };

  const checkKey = 'fs_preventive_checklist_items';
  const storedChecklist = localStorage.getItem(checkKey);
  if (storedChecklist) {
    try {
      const items = JSON.parse(storedChecklist);
      if (items.some((i: any) => i.id === 'chk1' || !i.id.startsWith('chk_p20_'))) {
        localStorage.removeItem(checkKey);
        items.forEach(async (it: any) => {
          try {
            await deleteDoc(doc(db, 'preventive_checklist_items', it.id));
          } catch(e) {}
        });
      }
    } catch (e) {}
  }

  Object.entries(seeds).forEach(([col, items]) => {
    const key = `fs_${col}`;
    if (!localStorage.getItem(key) || JSON.parse(localStorage.getItem(key) || '[]').length === 0) {
      localStorage.setItem(key, JSON.stringify(items));
      items.forEach(async (item: any) => {
        try {
          await setDoc(doc(db, col, item.id), item);
        } catch (e) {}
      });
    } else if (col === 'customers') {
      try {
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        const hasPD = existing.some((x: any) => x.id === 'c-pd' || x.name?.toUpperCase().includes('PD EMPILHADEIRAS'));
        if (!hasPD) {
          const pdItem = items.find((x: any) => x.id === 'c-pd');
          if (pdItem) {
            existing.push(pdItem);
            localStorage.setItem(key, JSON.stringify(existing));
            setDoc(doc(db, 'customers', 'c-pd'), pdItem).catch(() => {});
          }
        }
      } catch (e) {}
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
    if (this.pendingAction === 'select') {
      this.pendingAction = 'select';
    }
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

      const idFilter = this.filters.find(f => f.field === 'id' && f.op === '==');
      let data: any[] = [];

      if (idFilter) {
        const docId = idFilter.value;
        const localKey = `fs_${this.col}`;
        let singleData: any = null;
        try {
          const docSnap = await getDoc(doc(db, this.col, docId));
          if (docSnap.exists()) {
            singleData = { ...docSnap.data(), id: docSnap.id };
            let localCache: any[] = [];
            try {
              localCache = JSON.parse(localStorage.getItem(localKey) || '[]');
            } catch (e) {}
            localCache = localCache.filter((x: any) => x.id !== docId);
            localCache.push(singleData);
            localStorage.setItem(localKey, JSON.stringify(localCache));
          }
        } catch (err: any) {
          console.warn(`[FirebaseSync] Single doc fetch failed for ${this.col}/${docId}:`, err);
          try {
            const localCache = JSON.parse(localStorage.getItem(localKey) || '[]');
            singleData = localCache.find((x: any) => String(x.id).toLowerCase() === String(docId).toLowerCase()) || null;
          } catch (e) {}
          if (!isDummyConfig && (err.code === 'permission-denied' || err.message?.includes('permission') || err.message?.includes('key'))) {
            console.warn(`[FirebaseSync] Permission denied or config restricted for single doc fetch in ${this.col}/${docId}. Falling back to cached local data.`);
          }
        }
        data = singleData ? [singleData] : [];
      } else {
        data = await fetchColData(this.col);
      }

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

// forced sync
