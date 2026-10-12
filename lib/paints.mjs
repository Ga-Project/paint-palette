// paints.mjs — 塗料コレクションのドメインロジック（フレームワーク非依存）。
//
// この製品が答える問い＝「その色、もう持ってる?」を成立させる中核:
//   - 重複判定（同じブランド×色番なら“持ってる”）
//   - 無料枠の上限（50色。上限は正直な制限で、解放ボタンは持たない）
//   - パレット可視化のための並べ替え（色相順）と絞り込み
// UI もストレージも、判断はここに集約して一箇所で正しさを保つ。

import { normalizeHex, hexToHsl } from "./color.mjs";

/**
 * @typedef {Object} Paint
 * @property {string} id        端末内で一意（追加時に採番）
 * @property {string} brand     塗料ブランド名（記述的表記・ロゴは持たない）
 * @property {string} name      色名（例: "ミッドナイトブルー"）
 * @property {string} code      色番/型番（任意・重複判定の主キー）
 * @property {string} hex       #rrggbb（画面表示用の近似色）
 * @property {number} addedAt   追加時刻（epoch ms・並べ替え用）
 */

/** 無料枠で登録できる上限色数。これを超える登録はブロックする（有料の無制限化は v1 では凍結）。 */
export const FREE_CAP = 50;

/**
 * ブランドのプリセット（記述的表記のみ・公式ロゴや公式カラーチャートは同梱しない）。
 * リストに無いブランドは自由入力できる（「その他」）。
 */
export const BRAND_PRESETS = [
  "Mr.カラー",
  "水性ホビーカラー",
  "タミヤカラー アクリル",
  "タミヤカラー エナメル",
  "ガイアカラー",
  "アクリジョン",
  "ファレホ",
  "シタデルカラー",
  "ラッカー その他",
  "その他",
];

/** 並べ替えモード。 @typedef {"hue"|"recent"|"name"|"brand"} SortMode */

const collator = new Intl.Collator("ja");

/** 空白を畳んで整える。 @param {unknown} v @returns {string} */
function clean(v) {
  return typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
}

/**
 * 比較用に正規化する。NFKC で全角/半角のゆらぎ（Ｃ５⇔C5）を畳み、小文字化する。
 * 小文字化だけでは字幅は揃わないため、重複判定・検索はこのキーで突き合わせる。
 * @param {unknown} v
 * @returns {string}
 */
function normKey(v) {
  return clean(v).normalize("NFKC").toLowerCase();
}

/**
 * フォーム入力を検証して塗料フィールドに正規化する。
 * name と hex は必須。code は任意（重複判定の精度に効く）。
 * @param {{brand?:string,name?:string,code?:string,hex?:string}} input
 * @returns {{ok:true, value:{brand:string,name:string,code:string,hex:string}} | {ok:false, error:string, field:"name"|"hex"}}
 */
export function validatePaintInput(input) {
  const name = clean(input && input.name);
  const brand = clean(input && input.brand);
  const code = clean(input && input.code);
  const hex = normalizeHex((input && input.hex) || "");
  if (!name) return { ok: false, error: "色名を入力してください。", field: "name" };
  if (!hex) return { ok: false, error: "色は #RRGGBB 形式で入力してください。", field: "hex" };
  return { ok: true, value: { brand, name, code, hex } };
}

/**
 * 重複判定のキー。色番があれば「ブランド×色番」、無ければ「ブランド×色名」。
 * 大文字小文字・全角半角ゆらぎを避けるため小文字化して比較する。
 * @param {{brand:string,name:string,code:string}} p
 * @returns {string}
 */
export function dupeKey(p) {
  const brand = normKey(p.brand);
  const code = normKey(p.code);
  if (code) return `${brand}|code:${code}`;
  return `${brand}|name:${normKey(p.name)}`;
}

/**
 * 既に持っている同じ塗料を返す（無ければ null）。登録前の重複警告に使う。
 * @param {Paint[]} paints
 * @param {{brand:string,name:string,code:string}} candidate
 * @returns {Paint | null}
 */
export function findDuplicate(paints, candidate) {
  const key = dupeKey(candidate);
  for (const p of paints) {
    if (dupeKey(p) === key) return p;
  }
  return null;
}

/**
 * これ以上追加できるか（無料枠の上限判定）。
 * @param {number} count
 * @returns {boolean}
 */
export function canAdd(count) {
  return count < FREE_CAP;
}

/**
 * 上限までの残り枠。
 * @param {number} count
 * @returns {number}
 */
export function remaining(count) {
  return Math.max(0, FREE_CAP - count);
}

/**
 * 検証済みフィールドから Paint を作る。id と addedAt は外から渡す（テスト可能にするため）。
 * @param {{brand:string,name:string,code:string,hex:string}} fields
 * @param {{id:string, addedAt:number}} meta
 * @returns {Paint}
 */
export function makePaint(fields, meta) {
  return {
    id: meta.id,
    brand: fields.brand,
    name: fields.name,
    code: fields.code,
    hex: fields.hex,
    addedAt: meta.addedAt,
  };
}

/**
 * パレット表示用の並べ替え（非破壊）。
 * hue: 色相順（無彩色は末尾）／recent: 新しい順／name/brand: 日本語照合。
 * @param {Paint[]} paints
 * @param {SortMode} mode
 * @returns {Paint[]}
 */
export function sortPaints(paints, mode) {
  const arr = paints.slice();
  if (mode === "recent") {
    arr.sort((a, b) => b.addedAt - a.addedAt);
    return arr;
  }
  if (mode === "name") {
    arr.sort((a, b) => collator.compare(a.name, b.name));
    return arr;
  }
  if (mode === "brand") {
    arr.sort((a, b) => collator.compare(a.brand, b.brand) || collator.compare(a.name, b.name));
    return arr;
  }
  // hue（既定）: 色相→明度で並べ、無彩色（彩度ゼロ）は色の後ろへ。
  arr.sort((a, b) => {
    const ha = hexToHsl(a.hex) || { h: 0, s: 0, l: 0 };
    const hb = hexToHsl(b.hex) || { h: 0, s: 0, l: 0 };
    const ach = ha.s === 0;
    const bch = hb.s === 0;
    if (ach !== bch) return ach ? 1 : -1;
    if (ach && bch) return ha.l - hb.l;
    return ha.h - hb.h || ha.l - hb.l;
  });
  return arr;
}

/**
 * 絞り込み（ブランドの完全一致＋語のあいまい一致）。
 * query は色名・色番・ブランドのいずれかに部分一致すれば残す。
 * @param {Paint[]} paints
 * @param {{brand?:string, query?:string}} opts
 * @returns {Paint[]}
 */
export function filterPaints(paints, opts) {
  const brand = clean(opts && opts.brand);
  const q = normKey(opts && opts.query);
  return paints.filter((p) => {
    if (brand && p.brand !== brand) return false;
    if (!q) return true;
    return (
      normKey(p.name).includes(q) ||
      normKey(p.code).includes(q) ||
      normKey(p.brand).includes(q)
    );
  });
}

/**
 * コレクションに含まれるブランドの一覧（絞り込みプルダウン用・出現順を安定化して日本語照合）。
 * @param {Paint[]} paints
 * @returns {string[]}
 */
export function brandsInUse(paints) {
  const set = new Set();
  for (const p of paints) if (p.brand) set.add(p.brand);
  return Array.from(set).sort((a, b) => collator.compare(a, b));
}
