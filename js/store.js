// Datenzugriff hinter einer schlanken, async Schnittstelle.
//
// Die ganze App spricht NUR mit dieser Schnittstelle, nie direkt mit
// localStorage. Dadurch lässt sich später ein echter Backend-Store
// (z. B. Supabase) als Drop-in einsetzen: einfach eine neue Klasse mit
// denselben Methoden (load/save) schreiben und in main.js instanziieren.
//
//   interface Store {
//     async load(): Promise<Data | null>
//     async save(data: Data): Promise<void>
//   }
//
// Export/Import von JSON-Dateien sind reine Helfer und vom Store unabhängig.

const STORAGE_KEY = 'pkm-timeline-v6';

export class LocalStorageStore {
  constructor(key = STORAGE_KEY) {
    this.key = key;
  }

  async load() {
    const raw = localStorage.getItem(this.key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (err) {
      console.error('Konnte gespeicherte Daten nicht lesen:', err);
      return null;
    }
  }

  async save(data) {
    localStorage.setItem(this.key, JSON.stringify(data));
  }

  async clear() {
    localStorage.removeItem(this.key);
  }
}

// --- JSON Datei-Export / -Import (unabhängig vom Store) -------------------

export function exportJson(data, filename = 'zeitleiste.json') {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function importJson(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
