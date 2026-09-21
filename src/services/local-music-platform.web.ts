import { isAudioFilename, type LocalAudioFile } from '@/services/local-music-model';
import type { CrimsonSong } from '@/types/music';

type StoredAudio = { id: string; file: Blob; metadata: LocalAudioFile };
let database: Promise<IDBDatabase> | undefined;
const objectUrls = new Map<string, string>();
function openDatabase() {
  if (!database) database = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('Your browser cannot store local audio. Try a browser with IndexedDB enabled.')); return; }
    const request = indexedDB.open('crimson-local-audio', 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('audio', { keyPath: 'id' }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = undefined; reject(new Error('Local storage is unavailable. Allow site storage and try again.')); };
  });
  return database;
}
async function storedAudio(id: string): Promise<StoredAudio | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction('audio').objectStore('audio').get(id);
    request.onsuccess = () => resolve(request.result as StoredAudio | undefined);
    request.onerror = () => reject(request.error);
  });
}
async function saveAudio(record: StoredAudio) {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('audio', 'readwrite');
    tx.objectStore('audio').put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error('Not enough browser storage to import this audio. Free some site storage and try again.'));
    tx.onabort = tx.onerror;
  });
}
export async function listImportedAudio(): Promise<LocalAudioFile[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    // A cursor avoids cloning the entire audio library's Blobs into memory.
    const records: LocalAudioFile[] = [];
    const request = db.transaction('audio').objectStore('audio').openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) { resolve(records); return; }
      records.push((cursor.value as StoredAudio).metadata);
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}
function chooseFiles(folder: boolean): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file'; input.multiple = true; input.accept = 'audio/*,.flac,.opus,.aiff,.alac,.wma,.mka,.m4b,.m4r';
    if (folder) input.setAttribute('webkitdirectory', '');
    input.style.display = 'none';
    const finish = (files: File[]) => { input.remove(); resolve(files); };
    input.onchange = () => finish(Array.from(input.files || []));
    input.addEventListener('cancel', () => finish([]), { once: true });
    document.body.appendChild(input);
    input.click();
  });
}
function audioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const uri = URL.createObjectURL(file);
    const audio = new Audio();
    const done = (duration: number) => {
      clearTimeout(timeout); audio.onloadedmetadata = null; audio.onerror = null;
      audio.removeAttribute('src'); audio.load(); URL.revokeObjectURL(uri); resolve(duration);
    };
    const timeout = setTimeout(() => done(0), 4000);
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => done(Number.isFinite(audio.duration) ? audio.duration : 0);
    audio.onerror = () => done(0);
    audio.src = uri;
  });
}
export async function pickLocalAudio(folder = false) {
  const picked = await chooseFiles(folder);
  const files: LocalAudioFile[] = [];
  let skipped = 0;
  for (const file of picked) {
    if (!file.type.startsWith('audio/') && !isAudioFilename(file.name)) { skipped += 1; continue; }
    if (!file.size) { skipped += 1; continue; }
    const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    const id = `web:${Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
    const existing = await storedAudio(id);
    if (existing) { files.push(existing.metadata); continue; }
    const metadata: LocalAudioFile = {
      id, uri: `crimson-local://${id}`, filename: file.name, kind: 'import',
      size: file.size, duration: await audioDuration(file), modifiedAt: file.lastModified,
    };
    await saveAudio({ id, file, metadata });
    files.push(metadata);
  }
  return { files, skipped };
}
export async function scanDeviceAudio(): Promise<{ files: LocalAudioFile[]; skipped: number }> {
  throw new Error('Choose Import folder to add music from your computer. Browsers only access files you select.');
}
export async function removeImportedAudio(song: CrimsonSong) {
  const id = song.id.slice('local:'.length);
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('audio', 'readwrite'); tx.objectStore('audio').delete(id);
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  });
  const uri = objectUrls.get(id);
  if (uri) URL.revokeObjectURL(uri);
  objectUrls.delete(id);
}
export async function resolveLocalAudioUri(song: Pick<CrimsonSong, 'id' | 'url'>) {
  const id = song.id.slice('local:'.length);
  const existing = objectUrls.get(id);
  if (existing) return existing;
  const record = await storedAudio(id);
  if (!record) throw new Error('This audio file was removed from browser storage. Import it again.');
  const uri = URL.createObjectURL(record.file);
  objectUrls.set(id, uri);
  return uri;
}
