function openDatabase(name, version, stores) {
  return new Promise((resolve,reject) => {
    const request=indexedDB.open(name,version);
    let blocked=false;
    request.onupgradeneeded=()=>{
      for (const store of stores) if (!request.result.objectStoreNames.contains(store)) {
        request.result.createObjectStore(store,{keyPath:'id'});
      }
    };
    request.onblocked=()=>{
      blocked=true;
      reject(new Error('IndexedDB upgrade blocked by another tab'));
    };
    request.onsuccess=()=>{
      const db=request.result;
      if (blocked) db.close();
      else {
        db.onversionchange=()=>db.close();
        resolve(db);
      }
    };
    request.onerror=()=>reject(request.error);
  });
}

const database=openDatabase('ottisk-journal',2,['days','recordings']);
const oldNarrationDatabase=openDatabase('ottisk-narration',1,['recordings']);

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

export async function loadRecordings() {
  const [legacy, current] = await Promise.all([
    transact(oldNarrationDatabase,'recordings','readonly',store=>store.getAll()).catch(()=>[]),
    transact(database,'recordings','readonly',store=>store.getAll())
  ]);
  const records = new Map([...legacy,...current].map(record=>[record.id,record]));
  return [...records.values()].filter(record=>record.recording);
}

// A null record overrides any saved voice in the journal's old database.
export const saveRecording=(id,recording)=>transact(database,'recordings','readwrite',store=>store.put({id,recording}));

export async function importDays(days) {
  const db=await database;
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction(['days','recordings'],'readwrite');
    const records=transaction.objectStore('days');
    const voices=transaction.objectStore('recordings');
    const added=[];
    const ids=new Set();
    for (const day of days) {
      if (ids.has(day.id)) continue;
      ids.add(day.id);
      const existing=records.getKey(day.id);
      existing.onsuccess=()=>{
        if (existing.result!==undefined) return;
        const {voiceRecording,...record}=day;
        records.add(record);
        voices.put({id:day.id,recording:voiceRecording ?? null});
        added.push(day);
      };
    }
    transaction.oncomplete=()=>resolve(added);
    transaction.onabort=()=>reject(transaction.error);
    transaction.onerror=()=>reject(transaction.error);
  });
}
