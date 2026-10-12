// paints.test.mjs — この製品が答える問い「その色、もう持ってる?」を固定する。
//
// 重複判定・無料枠の上限・パレットの並べ替え/絞り込みは中核なので、
// 境界（色番あり/なし・ちょうど50色・無彩色の並び）を押さえる。

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FREE_CAP,
  validatePaintInput,
  dupeKey,
  findDuplicate,
  canAdd,
  remaining,
  makePaint,
  sortPaints,
  filterPaints,
  brandsInUse,
} from "../lib/paints.mjs";

/** テスト用に Paint を素早く作る。 */
function p(fields, id = fields.code || fields.name, addedAt = 0) {
  const v = validatePaintInput(fields);
  assert.ok(v.ok, `不正なテスト入力: ${JSON.stringify(fields)}`);
  return makePaint(v.value, { id, addedAt });
}

test("validatePaintInput は色名と色を必須にし、HEX を正規化する", () => {
  assert.equal(validatePaintInput({ name: "", hex: "#fff" }).ok, false);
  assert.equal(validatePaintInput({ name: "赤", hex: "zzz" }).ok, false);
  const ok = validatePaintInput({ brand: " Mr.カラー ", name: " レッド ", code: " C3 ", hex: "F00" });
  assert.deepEqual(ok.ok && ok.value, {
    brand: "Mr.カラー",
    name: "レッド",
    code: "C3",
    hex: "#ff0000",
  });
});

test("dupeKey は色番があれば色番、無ければ色名で決まる", () => {
  assert.equal(dupeKey({ brand: "タミヤ", name: "赤", code: "X-7" }), "タミヤ|code:x-7");
  assert.equal(dupeKey({ brand: "タミヤ", name: "赤", code: "" }), "タミヤ|name:赤");
  // 大文字小文字は無視
  assert.equal(
    dupeKey({ brand: "Vallejo", name: "Red", code: "AB-1" }),
    dupeKey({ brand: "vallejo", name: "red", code: "ab-1" }),
  );
  // 全角/半角のゆらぎ（NFKC）も同一キーに畳む（Ｃ５ ⇔ C5）
  assert.equal(
    dupeKey({ brand: "Ｍｒ．カラー", name: "青", code: "Ｃ５" }),
    dupeKey({ brand: "Mr.カラー", name: "青", code: "C5" }),
  );
});

test("findDuplicate は同じブランド×色番の既所有を返す", () => {
  const owned = [
    p({ brand: "Mr.カラー", name: "ブルー", code: "C5", hex: "#0033aa" }),
    p({ brand: "タミヤ", name: "レッド", code: "X-7", hex: "#cc0000" }),
  ];
  const hit = findDuplicate(owned, { brand: "mr.カラー", name: "青", code: "c5" });
  assert.equal(hit?.code, "C5");
  const miss = findDuplicate(owned, { brand: "Mr.カラー", name: "青", code: "C99" });
  assert.equal(miss, null);
});

test("無料枠は 50 色で頭打ちになる（上限は正直な制限）", () => {
  assert.equal(FREE_CAP, 50);
  assert.equal(canAdd(0), true);
  assert.equal(canAdd(49), true);
  assert.equal(canAdd(50), false);
  assert.equal(canAdd(51), false);
  assert.equal(remaining(0), 50);
  assert.equal(remaining(50), 0);
  assert.equal(remaining(60), 0);
});

test("sortPaints hue は色相順に並べ、無彩色を末尾へ回す", () => {
  const paints = [
    p({ name: "灰", hex: "#808080" }, "gray"),
    p({ name: "青", hex: "#0000ff" }, "blue"),
    p({ name: "赤", hex: "#ff0000" }, "red"),
    p({ name: "緑", hex: "#00ff00" }, "green"),
  ];
  const order = sortPaints(paints, "hue").map((x) => x.id);
  assert.deepEqual(order, ["red", "green", "blue", "gray"]);
});

test("sortPaints recent は新しい順", () => {
  const paints = [
    p({ name: "古", hex: "#111111" }, "old", 100),
    p({ name: "新", hex: "#222222" }, "new", 300),
    p({ name: "中", hex: "#333333" }, "mid", 200),
  ];
  assert.deepEqual(sortPaints(paints, "recent").map((x) => x.id), ["new", "mid", "old"]);
});

test("sortPaints name は日本語照合で色名順に並べる", () => {
  const paints = [
    p({ name: "レッド", hex: "#ff0000" }, "r"),
    p({ name: "あお", hex: "#0000ff" }, "b"),
    p({ name: "きいろ", hex: "#ffff00" }, "y"),
  ];
  assert.deepEqual(sortPaints(paints, "name").map((x) => x.name), ["あお", "きいろ", "レッド"]);
});

test("sortPaints brand はブランド順→同ブランド内は色名順", () => {
  const paints = [
    p({ brand: "タミヤ", name: "ブルー", hex: "#0000ff" }, "t-b"),
    p({ brand: "Mr.カラー", name: "レッド", hex: "#ff0000" }, "m-r"),
    p({ brand: "タミヤ", name: "アンバー", hex: "#886600" }, "t-a"),
  ];
  assert.deepEqual(sortPaints(paints, "brand").map((x) => x.id), ["m-r", "t-a", "t-b"]);
});

test("filterPaints はブランドと語を同時に満たすもの(AND)だけ残す", () => {
  const paints = [
    p({ brand: "タミヤ", name: "フラットブラック", code: "XF-1", hex: "#111111" }),
    p({ brand: "タミヤ", name: "レッド", code: "X-7", hex: "#cc0000" }),
    p({ brand: "Mr.カラー", name: "ブラック", code: "C2", hex: "#101010" }),
  ];
  const hit = filterPaints(paints, { brand: "タミヤ", query: "ブラック" });
  assert.equal(hit.length, 1);
  assert.equal(hit[0]?.code, "XF-1");
});

test("filterPaints はブランド一致と語のあいまい一致で絞る", () => {
  const paints = [
    p({ brand: "タミヤ", name: "フラットブラック", code: "XF-1", hex: "#111111" }),
    p({ brand: "Mr.カラー", name: "ホワイト", code: "C1", hex: "#eeeeee" }),
  ];
  assert.equal(filterPaints(paints, { brand: "タミヤ" }).length, 1);
  assert.equal(filterPaints(paints, { query: "ブラック" }).length, 1);
  assert.equal(filterPaints(paints, { query: "xf-1" }).length, 1);
  assert.equal(filterPaints(paints, { query: "c1" }).length, 1);
  assert.equal(filterPaints(paints, { query: "存在しない" }).length, 0);
});

test("brandsInUse は使用中ブランドを重複なく返す", () => {
  const paints = [
    p({ brand: "タミヤ", name: "a", hex: "#010101" }, "a"),
    p({ brand: "Mr.カラー", name: "b", hex: "#020202" }, "b"),
    p({ brand: "タミヤ", name: "c", hex: "#030303" }, "c"),
  ];
  assert.deepEqual(brandsInUse(paints), ["Mr.カラー", "タミヤ"]);
});
