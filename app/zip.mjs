const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8',{fatal:true});
const crcTable = Uint32Array.from({length:256},(_,index)=>{
  let value=index;
  for(let bit=0;bit<8;bit++) value=(value>>>1)^((value&1)?0xedb88320:0);
  return value;
});

function crc32(bytes) {
  let value=0xffffffff;
  for (const byte of bytes) value=(value>>>8)^crcTable[(value^byte)&255];
  return (value^0xffffffff)>>>0;
}

function writeRecord(size, words, shorts) {
  const view=new DataView(new ArrayBuffer(size));
  for (const [position,value] of words) view.setUint32(position,value,true);
  for (const [position,value] of shorts) view.setUint16(position,value,true);
  return view.buffer;
}

export async function writeZip(entries) {
  const contents=[];
  const directory=[];
  let offset=0, directoryLength=0;
  if(entries.length>65535) throw Error('Слишком много файлов.');
  for (const [filename, entry] of entries) {
    const path=encoder.encode(filename);
    const bytes=typeof entry==='string'?encoder.encode(entry):new Uint8Array(await entry.arrayBuffer());
    const checksum=crc32(bytes);
    const size=bytes.length;
    if(offset+size+30+path.length>=0xffffffff) throw Error('Архив слишком велик.');
    const flags=0x800;
    contents.push(writeRecord(30,[[0,0x04034b50],[14,checksum],[18,size],[22,size]],[[4,20],[6,flags],[12,33],[26,path.length]]),path,bytes);
    // Marked as made on Unix with ordinary file permissions: Info-ZIP on Linux then keeps Cyrillic folder names.
    directory.push(writeRecord(46,[[0,0x02014b50],[16,checksum],[20,size],[24,size],[38,0x81a40000],[42,offset]],[[4,0x0314],[6,20],[8,flags],[14,33],[28,path.length]]),path);
    offset+=30+path.length+size;
    directoryLength+=46+path.length;
  }
  if(offset+directoryLength+22>=0xffffffff) throw Error('Архив слишком велик.');
  const end=writeRecord(22,[[0,0x06054b50],[12,directoryLength],[16,offset]],[[8,entries.length],[10,entries.length]]);
  return new Blob([...contents,...directory,end],{type:'application/zip'});
}

const invalid = () => new Error('Invalid Ottisk ZIP');
const view = async (blob, start, end) => new DataView(await blob.slice(start,end).arrayBuffer());
const u16 = (data,index) => data.getUint16(index,true);
const u32 = (data,index) => data.getUint32(index,true);
const string = (data,start,end) => decoder.decode(new Uint8Array(data.buffer,start,end-start));
export const validFileName = name => typeof name==='string' && name.length>0 && name.length<=255
  && name!=='.' && name!=='..' && !/[\\/\u0000-\u001f\u007f]/u.test(name);

// Ottisk writes ZIP32 with stored entries. Read just the directory and the
// requested records, so opening the archive never executes or extracts HTML.
export async function readZip(file) {
  if (file.size<22 || file.size>=0xffffffff) throw invalid();
  const end=await view(file,file.size-22,file.size);
  if (u32(end,0)!==0x06054b50 || u32(end,4)!==0 || u16(end,8)!==u16(end,10) || u16(end,20)!==0) throw invalid();
  const length=u32(end,12), offset=u32(end,16), count=u16(end,10);
  if (length>24*1024*1024 || offset+length!==file.size-22) throw invalid();
  const directory=await view(file,offset,offset+length);
  const files=new Map();
  let cursor=0;
  for (let index=0;index<count;index++) {
    if (cursor+46>length || u32(directory,cursor)!==0x02014b50) throw invalid();
    const flags=u16(directory,cursor+8), size=u32(directory,cursor+24), checksum=u32(directory,cursor+16);
    const start=u32(directory,cursor+42), pathLength=u16(directory,cursor+28);
    const next=cursor+46+pathLength+u16(directory,cursor+30)+u16(directory,cursor+32);
    if (next>length || flags!==0x800 || u16(directory,cursor+10)!==0 || size!==u32(directory,cursor+20)
      || u16(directory,cursor+34)!==0 || start+30+pathLength+size>offset) throw invalid();
    const name=string(directory,cursor+46,cursor+46+pathLength);
    if (!name.split('/').every(validFileName) || files.has(name)) throw invalid();
    files.set(name,{start,size,flags,checksum,pathLength});
    cursor=next;
  }
  if (cursor!==length) throw invalid();
  return {
    names: Array.from(files.keys()),
    async get(name, maxSize) {
      const record=files.get(name);
      if (!record || record.size>maxSize) throw invalid();
      const {start,size,flags,checksum,pathLength}=record;
      const header=await view(file,start,start+30+pathLength);
      if (u32(header,0)!==0x04034b50 || u16(header,6)!==flags || u16(header,8)!==0
        || u32(header,14)!==checksum || u32(header,18)!==size || u32(header,22)!==size
        || u16(header,26)!==pathLength || string(header,30,30+pathLength)!==name) throw invalid();
      const dataStart=start+30+pathLength+u16(header,28);
      if (dataStart+size>offset) throw invalid();
      const blob=file.slice(dataStart,dataStart+size);
      if (crc32(new Uint8Array(await blob.arrayBuffer()))!==checksum) throw invalid();
      return blob;
    }
  };
}
