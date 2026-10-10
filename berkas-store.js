/**
 * @fileoverview Penyimpanan berkas unggahan untuk PROTOTIPE (IndexedDB,
 * origin yang sama dipakai semua halaman/akun). Berkas disimpan sekali dan
 * dirujuk lewat `berkasId` (hash isi); akun lain (Verifikator, Validator,
 * Direktur, ...) memuatnya lagi untuk pratinjau. Saat backend siap,
 * `berkasId` = id berkas dari server dan `ambilBerkas` diganti
 * `GET /api/v1/berkas/{id}`; modul ini dihapus bersama js/mocks/.
 * Semua fungsi aman dipanggil tanpa IndexedDB (mengembalikan null).
 */

const DB_NAME = 'tka-berkas';
const STORE = 'berkas';
const ID_LENGTH = 24;

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB tidak tersedia'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE,
      { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function hashId(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16)
    .padStart(2, '0')).join('').slice(0, ID_LENGTH);
}

/**
 * Simpan berkas; id sama untuk isi yang sama.
 * @param {!File} file
 * @return {!Promise<?string>} berkasId, atau null bila gagal menyimpan.
 */
export async function simpanBerkas(file) {
  try {
    const buffer = await file.arrayBuffer();
    const id = await hashId(buffer);
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ id, blob: new Blob([buffer],
        { type: file.type }), nama: file.name });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    return id;
  } catch (error) {
    console.warn('[MOCK] berkas tidak tersimpan', error);
    return null;
  }
}

/**
 * @param {?string} id berkasId
 * @return {!Promise<?Blob>} isi berkas, null bila tidak ada.
 */
export async function ambilBerkas(id) {
  if (!id) {
    return null;
  }
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE).objectStore(STORE).get(id);
      request.onsuccess = () => resolve(request.result?.blob ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}
