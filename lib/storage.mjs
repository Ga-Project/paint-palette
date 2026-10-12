// storage.mjs — 端末内保存（IndexedDB）。アカウント不要・オフライン可のための唯一の保存先。
//
// 静的配信でサーバを持たないため、コレクションはこの端末のブラウザにだけ残す。
// IndexedDB を薄く包んだだけの IO 層で、ドメイン判断（重複/上限/並べ替え）は paints.mjs に置く。
// 例外は握り潰さず呼び出し側へ投げる（保存できないことをユーザーに伝えるため）。

const DB_NAME = "paint-palette";
const STORE = "paints";
const VERSION = 1;

/** @returns {boolean} この環境で IndexedDB が使えるか。 */
export function storageAvailable() {
  try {
    return typeof indexedDB !== "undefined";
  } catch {
    return false;
  }
}

/** @returns {Promise<IDBDatabase>} */
function openDb() {
  return new Promise((resolve, reject) => {
    if (!storageAvailable()) {
      reject(new Error("この端末では保存領域（IndexedDB）が使えません。"));
      return;
    }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("保存領域を開けませんでした。"));
  });
}

/**
 * トランザクションを Promise で包む。
 * @param {IDBObjectStore} store が属するトランザクションの完了を待つ。
 * @param {IDBTransaction} tx
 * @returns {Promise<void>}
 */
function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error || new Error("保存に失敗しました。"));
  });
}

/**
 * 保存済みの塗料をすべて取り出す。
 * @returns {Promise<import("./paints.mjs").Paint[]>}
 */
export async function getAllPaints() {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const all = await new Promise((resolve, reject) => {
      const r = store.getAll();
      r.onsuccess = () => resolve(r.result || []);
      r.onerror = () => reject(r.error);
    });
    await txDone(tx);
    return /** @type {import("./paints.mjs").Paint[]} */ (all);
  } finally {
    db.close();
  }
}

/**
 * 1件を追加/更新する（keyPath=id で upsert）。
 * @param {import("./paints.mjs").Paint} paint
 * @returns {Promise<void>}
 */
export async function putPaint(paint) {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(paint);
    await txDone(tx);
  } finally {
    db.close();
  }
}

/**
 * 上限未満のときだけ 1件を追加する（count と put を同一トランザクションで原子的に行う）。
 * 無料枠の上限は中核の不変条件なので、2タブが同時に上限直前まで埋めても超えないよう、
 * 件数確認と書き込みを1つの readwrite tx 内で完結させる（await を挟むと tx が閉じるため
 * count の onsuccess コールバックの中で put を発行する）。
 * @param {import("./paints.mjs").Paint} paint
 * @param {number} cap
 * @returns {Promise<{ok:true,count:number} | {ok:false,reason:"cap",count:number}>}
 */
export function putIfUnderCap(paint, cap) {
  return new Promise((resolve, reject) => {
    openDb().then(
      (db) => {
        const tx = db.transaction(STORE, "readwrite");
        const store = tx.objectStore(STORE);
        /** @type {{ok:true,count:number} | {ok:false,reason:"cap",count:number}} */
        let outcome = { ok: false, reason: "cap", count: 0 };
        const cr = store.count();
        cr.onsuccess = () => {
          const n = cr.result;
          if (n >= cap) {
            outcome = { ok: false, reason: "cap", count: n };
            // 何も書かずに tx を自然完了させる。
          } else {
            store.put(paint);
            outcome = { ok: true, count: n + 1 };
          }
        };
        tx.oncomplete = () => {
          db.close();
          resolve(outcome);
        };
        tx.onabort = tx.onerror = () => {
          db.close();
          reject(tx.error || new Error("保存に失敗しました。"));
        };
      },
      (err) => reject(err),
    );
  });
}

/**
 * 1件を削除する。
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deletePaint(id) {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    await txDone(tx);
  } finally {
    db.close();
  }
}

/**
 * 保存件数（上限判定に使う）。
 * @returns {Promise<number>}
 */
export async function countPaints() {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const n = await new Promise((resolve, reject) => {
      const r = store.count();
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    await txDone(tx);
    return /** @type {number} */ (n);
  } finally {
    db.close();
  }
}
