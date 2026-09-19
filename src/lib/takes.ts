export type Take = {
  id: string;
  name: string;
  created: number;
  seconds: number;
  blob: Blob;
  harmony: boolean;
};
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("voxmio-studio", 1);
    req.onupgradeneeded = () =>
      req.result.createObjectStore("takes", { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function transact<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("takes", mode),
      req = action(tx.objectStore("takes"));
    tx.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("Storage unavailable"));
    };
  });
}
export const listTakes = () =>
  transact("readonly", (s) => s.getAll()) as Promise<Take[]>;
export const saveTake = (take: Take) =>
  transact("readwrite", (s) => s.put(take));
export const deleteTake = (id: string) =>
  transact("readwrite", (s) => s.delete(id));
