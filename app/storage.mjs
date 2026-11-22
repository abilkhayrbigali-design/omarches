function openStore(databaseName, storeName) {
  return new Promise((resolve,reject) => {
    const request=indexedDB.open(databaseName,1);
    request.onupgradeneeded=()=>request.result.createObjectStore(storeName,{keyPath:'id'});
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}

// Voice choices also belong to the built-in days, which live outside the journal store.
const database=openStore('ottisk-journal','days');
const narrationDatabase=openStore('ottisk-narration','recordings');

async function transact(connection, storeName, mode, action) {
  const db=await connection;
  return new Promise((resolve,reject) => {
    const transaction=db.transaction(storeName,mode);
    const request=action(transaction.objectStore(storeName));
    transaction.oncomplete=()=>resolve(request.result);
    transaction.onabort=()=>reject(transaction.error);
    transaction.onerror=()=>reject(transaction.error);
  });
}
export const loadDays=()=>transact(database,'days','readonly',store=>store.getAll());
export const saveDay=day=>transact(database,'days','readwrite',store=>store.put(day));
export const deleteDay=id=>transact(database,'days','readwrite',store=>store.delete(id));
export const loadRecordings=()=>transact(narrationDatabase,'recordings','readonly',store=>store.getAll());
export const saveRecording=(id,recording)=>transact(narrationDatabase,'recordings','readwrite',
  store=>recording ? store.put({id,recording}) : store.delete(id));
