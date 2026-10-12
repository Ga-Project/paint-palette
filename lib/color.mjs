// color.mjs — 色の計算（フレームワーク非依存の純ロジック）。
//
// スウォッチは「実際の塗料色」を主役に見せる製品なので、色の扱いを一箇所に固める:
//   - HEX の検証と正規化（#RGB / #RRGGBB を受ける）
//   - 並べ替え用の色相（HSL の H）
//   - スウォッチ上のラベルを黒/白どちらにするか（相対輝度で決める）
// ブラウザにも Node（テスト）にも依存が無いよう、DOM/Canvas を使わず算術だけで解く。

/**
 * 入力を #RRGGBB（小文字）に正規化する。受理できなければ null。
 * 受理: "#abc" / "abc" / "#AABBCC" / "AABBCC"（前後空白可）。
 * @param {string} input
 * @returns {string | null}
 */
export function normalizeHex(input) {
  if (typeof input !== "string") return null;
  let s = input.trim().toLowerCase();
  if (s.startsWith("#")) s = s.slice(1);
  if (/^[0-9a-f]{3}$/.test(s)) {
    s = s
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (/^[0-9a-f]{6}$/.test(s)) return "#" + s;
  return null;
}

/** HEX として妥当か。 @param {string} input @returns {boolean} */
export function isValidHex(input) {
  return normalizeHex(input) !== null;
}

/**
 * #RRGGBB → {r,g,b}（各 0..255）。不正なら null。
 * @param {string} hex
 * @returns {{r:number,g:number,b:number} | null}
 */
export function hexToRgb(hex) {
  const n = normalizeHex(hex);
  if (!n) return null;
  return {
    r: parseInt(n.slice(1, 3), 16),
    g: parseInt(n.slice(3, 5), 16),
    b: parseInt(n.slice(5, 7), 16),
  };
}

/**
 * #RRGGBB → {h,s,l}（h:0..360, s/l:0..100）。並べ替えの安定化のため丸める。
 * 無彩色（灰）は h=0,s=0 として扱う。
 * @param {string} hex
 * @returns {{h:number,s:number,l:number} | null}
 */
export function hexToHsl(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/**
 * sRGB 相対輝度（WCAG 定義・0..1）。
 * @param {string} hex
 * @returns {number}
 */
export function relativeLuminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const lin = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
}

/**
 * 2色のコントラスト比（1..21）。
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * スウォッチ（背景=塗料色）の上に載せるラベル文字色を黒/白から選ぶ。
 * 黒と白それぞれのコントラスト比を比べ、高い方を採用する（＝必ず読みやすい方）。
 * @param {string} swatchHex
 * @returns {"#000000" | "#ffffff"}
 */
export function readableInk(swatchHex) {
  const onBlack = contrastRatio(swatchHex, "#000000");
  const onWhite = contrastRatio(swatchHex, "#ffffff");
  return onWhite >= onBlack ? "#ffffff" : "#000000";
}
