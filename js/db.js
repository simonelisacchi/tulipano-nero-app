// db.js — livello dati locale (IndexedDB).
// Ogni record ha: id, ...campi, aggiornatoIl (timestamp ISO), eliminato (bool), sincronizzato (bool)
// Questo è ciò che rende l'app utilizzabile SENZA internet: si scrive sempre qui per prima cosa.

const DB_NAME = 'tulipano-nero-db';
const DB_VERSION = 2; // aumentata per aggiungere lo store "ferie" ai dispositivi già in uso
const STORES = ['clienti', 'magazzino', 'agenda', 'ferie'];

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      STORES.forEach((store) => {
        if (!db.objectStoreNames.contains(store)) {
          const os = db.createObjectStore(store, { keyPath: 'id' });
          os.createIndex('aggiornatoIl', 'aggiornatoIl');
        }
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const DB = {
  async getAll(store) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result.filter((r) => !r.eliminato));
      req.onerror = () => reject(req.error);
    });
  },

  async getAllIncludingDeleted(store) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async get(store, id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },

  // Crea o aggiorna. Se record.id manca, ne genera uno nuovo.
  async save(store, record) {
    const db = await openDB();
    const toSave = {
      ...record,
      id: record.id || uuid(),
      aggiornatoIl: new Date().toISOString(),
      eliminato: !!record.eliminato,
      sincronizzato: false
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(toSave);
      tx.oncomplete = () => resolve(toSave);
      tx.onerror = () => reject(tx.error);
    });
  },

  // Cancellazione "soft": marca come eliminato invece di rimuoverlo subito,
  // così la cancellazione può essere sincronizzata anche su Google Sheets.
  async remove(store, id) {
    const existing = await DB.get(store, id);
    if (!existing) return;
    return DB.save(store, { ...existing, id, eliminato: true });
  },

  // Usato dal modulo di sincronizzazione per scrivere dati arrivati da Google Sheets
  // senza marcarli di nuovo come "da sincronizzare".
  async saveFromRemote(store, record) {
    const db = await openDB();
    const toSave = { ...record, sincronizzato: true };
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(toSave);
      tx.oncomplete = () => resolve(toSave);
      tx.onerror = () => reject(tx.error);
    });
  },

  async markSynced(store, id) {
    const existing = await DB.get(store, id);
    if (!existing) return;
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put({ ...existing, sincronizzato: true });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async getPending(store) {
    const all = await DB.getAllIncludingDeleted(store);
    return all.filter((r) => !r.sincronizzato);
  }
};
