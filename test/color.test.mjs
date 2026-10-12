// color.test.mjs — 色の計算を固定する。
//
// スウォッチの見え方（並び順・ラベルの読みやすさ）はここが正しくないと崩れる。
// 特に readableInk はアクセシビリティの要（塗料色の上の文字が読めるか）なので境界を押さえる。

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeHex,
  isValidHex,
  hexToRgb,
  hexToHsl,
  contrastRatio,
  readableInk,
} from "../lib/color.mjs";

test("normalizeHex は #RGB / RRGGBB / 前後空白を受けて #rrggbb にする", () => {
  assert.equal(normalizeHex("#abc"), "#aabbcc");
  assert.equal(normalizeHex("ABC"), "#aabbcc");
  assert.equal(normalizeHex("  #A1B2C3  "), "#a1b2c3");
  assert.equal(normalizeHex("aabbcc"), "#aabbcc");
});

test("normalizeHex は不正入力を弾く", () => {
  assert.equal(normalizeHex("#ggg"), null);
  assert.equal(normalizeHex("#12345"), null);
  assert.equal(normalizeHex("rgb(0,0,0)"), null);
  assert.equal(normalizeHex(""), null);
  assert.equal(normalizeHex(/** @type {any} */ (null)), null);
});

test("isValidHex は normalizeHex と整合する", () => {
  assert.equal(isValidHex("#fff"), true);
  assert.equal(isValidHex("#office"), false);
});

test("hexToRgb は各チャンネルを取り出す", () => {
  assert.deepEqual(hexToRgb("#ff8800"), { r: 255, g: 136, b: 0 });
  assert.equal(hexToRgb("xyz"), null);
});

test("hexToHsl は原色の色相を返し、無彩色は s=0", () => {
  assert.equal(hexToHsl("#ff0000")?.h, 0);
  assert.equal(hexToHsl("#00ff00")?.h, 120);
  assert.equal(hexToHsl("#0000ff")?.h, 240);
  const gray = hexToHsl("#808080");
  assert.equal(gray?.s, 0);
});

test("contrastRatio は白黒で最大 21:1、同色で 1:1", () => {
  assert.ok(Math.abs(contrastRatio("#000000", "#ffffff") - 21) < 0.01);
  assert.ok(Math.abs(contrastRatio("#123456", "#123456") - 1) < 0.001);
});

test("readableInk は明るい色に黒・暗い色に白を選ぶ（塗料上の文字が読める）", () => {
  assert.equal(readableInk("#ffff00"), "#000000"); // 明るい黄 → 黒字
  assert.equal(readableInk("#ffffff"), "#000000");
  assert.equal(readableInk("#000080"), "#ffffff"); // 濃紺 → 白字
  assert.equal(readableInk("#000000"), "#ffffff");
  // 選んだ側は必ず AA（4.5:1）以上のコントラストを満たす
  for (const hex of ["#ff8800", "#3366cc", "#7a7a7a", "#c0ffee", "#204020"]) {
    const ink = readableInk(hex);
    assert.ok(contrastRatio(hex, ink) >= 4.5, `${hex} 上の ${ink} が読みにくい`);
  }
});
