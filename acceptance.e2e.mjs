/**
 * ペイントパレット 受入E2E — コンソール check_items の機械実行版。
 * キーは check_items.key と一致させること（ずれるとランナーが警告を出す）。
 *
 * 方針: 実装内部を覗かず、利用者の操作（登録する・重複警告を見る・絞り込む）だけで判定する。
 *       表示が出たことだけでなく、操作の前後で持ち色が正しく増減することまで見る。
 */

const NAME = "#paint-name";
const CODE = "#paint-code";
const HEX = "#paint-hex";
const BRAND = "#paint-brand";
const SEARCH = "#palette-search";

/* ---------------------------------------------------------------- 保存領域の下ごしらえ */

/** IndexedDB(paint-palette) を空にする。 */
async function clearDb(h) {
  await h.page.evaluate(
    () =>
      new Promise((resolve) => {
        const req = indexedDB.deleteDatabase("paint-palette");
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(true);
        req.onblocked = () => resolve(true);
      }),
  );
}

/** 塗料をまとめて端末内に仕込む（リロードで画面に出る）。 */
async function seed(h, paints) {
  await h.page.evaluate(
    (rows) =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open("paint-palette", 1);
        open.onupgradeneeded = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains("paints")) {
            db.createObjectStore("paints", { keyPath: "id" });
          }
        };
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("paints", "readwrite");
          const store = tx.objectStore("paints");
          rows.forEach((r) => store.put(r));
          tx.oncomplete = () => {
            db.close();
            resolve(true);
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    paints,
  );
}

function paint(i, over = {}) {
  return {
    id: `seed-${i}`,
    brand: over.brand ?? "Mr.カラー",
    name: over.name ?? `色${i}`,
    code: over.code ?? `C${i}`,
    hex: over.hex ?? "#3366cc",
    addedAt: 1000 + i,
  };
}

/** 登録フォームを開いて入力する（追加ボタンは押さない）。 */
async function openFormAndFill(h, { brand, name, code, hex }) {
  await h.clickText("塗料を登録");
  await h.wait(150);
  if (brand) await h.page.select(BRAND, brand);
  if (name !== undefined) await h.fill(NAME, name);
  if (code !== undefined) await h.fill(CODE, code);
  if (hex) await h.fill(HEX, hex);
}

async function paletteNames(h) {
  return h.page.$$eval(".dab-name", (els) => els.map((e) => (e.textContent || "").trim()));
}

async function capacityCount(h) {
  return h.page.$eval(".capacity-count", (e) => parseInt(e.textContent || "0", 10));
}

/* ---------------------------------------------------------------- 受入項目 */

export const items = {
  /** 塗料を登録すると持ち色パレットに増える（この製品の土台）。 */
  "register-paint": async (h) => {
    await h.goto("/");
    await clearDb(h);
    await h.goto("/");
    await h.expectText("まだ塗料がありません");
    await openFormAndFill(h, { name: "モンザレッド", code: "C68", hex: "#c8102e" });
    await h.clickText("パレットに追加");
    await h.wait(300);
    const names = await paletteNames(h);
    if (!names.includes("モンザレッド")) {
      throw new Error(`登録した色がパレットに出ません: ${JSON.stringify(names)}`);
    }
    const count = await capacityCount(h);
    if (count !== 1) throw new Error(`持ち色カウントが 1 になりません（${count}）`);
    h.note(`登録後 パレット=${names.join("/")} / 持ち色=${count}`);
  },

  /** 同じブランド×色番を登録しようとすると、買う前に重複を知らせる（この製品の主目的）。 */
  "duplicate-warning": async (h) => {
    await h.goto("/");
    await clearDb(h);
    await seed(h, [
      paint(1, { brand: "タミヤカラー アクリル", name: "レッド", code: "X-7", hex: "#c0392b" }),
    ]);
    await h.goto("/");
    await h.expectText("レッド");
    await openFormAndFill(h, {
      brand: "タミヤカラー アクリル",
      name: "赤",
      code: "X-7",
      hex: "#d33",
    });
    await h.clickText("パレットに追加");
    await h.wait(250);
    await h.expectText("すでに持っています");
    await h.expectText("重複を承知で登録");
    // 承知で登録しなければ増えない（警告が空振りでないこと）
    const before = await capacityCount(h);
    if (before !== 1) throw new Error(`警告時点で勝手に増えています（${before}）`);
    h.note("同一ブランド×色番で重複警告が出て、登録は保留された");
  },

  /** 無料枠の上限(50)に達すると追加できず、購入/解放ボタンを出さない（正直な上限）。 */
  "free-cap-honest": async (h) => {
    await h.goto("/");
    await clearDb(h);
    await seed(
      h,
      Array.from({ length: 50 }, (_, i) => paint(i, { hex: "#888888" })),
    );
    await h.goto("/");
    const count = await capacityCount(h);
    if (count !== 50) throw new Error(`50色を仕込めていません（${count}）`);
    await h.clickText("塗料を登録");
    await h.wait(200);
    await h.expectText("上限");
    // 正直な上限＝購入/課金/解放/アップグレードへの導線を絶対に出さない
    for (const banned of ["購入", "アップグレード", "解放", "Pro"]) {
      await h.expectNoText(banned);
    }
    h.note("50/50 で登録ブロック・購入/解放ボタンなし（honest cap）");
  },

  /** 色名・色番で絞り込め、0件は次の行き先（解除）を示す。 */
  "search-filter": async (h) => {
    await h.goto("/");
    await clearDb(h);
    await seed(h, [
      paint(1, { name: "ミッドナイトブルー", code: "C5", hex: "#1f3a93" }),
      paint(2, { name: "フラットホワイト", code: "C1", hex: "#eeeeee" }),
    ]);
    await h.goto("/");
    await h.fill(SEARCH, "ミッドナイト");
    await h.wait(250);
    let names = await paletteNames(h);
    if (names.length !== 1 || !names[0].includes("ミッドナイト")) {
      throw new Error(`検索の絞り込みが効いていません: ${JSON.stringify(names)}`);
    }
    await h.fill(SEARCH, "ぞぞぞ");
    await h.wait(250);
    await h.expectText("条件に合う塗料はありません");
    await h.clickText("絞り込みを解除");
    await h.wait(200);
    names = await paletteNames(h);
    if (names.length !== 2) throw new Error(`解除後に全件へ戻りません（${names.length}）`);
    h.note("検索1件→0件表示→解除で全件");
  },

  /** 再訪しても端末内のデータが残る（サーバなしの価値）。 */
  "persist-reload": async (h) => {
    await h.goto("/");
    await clearDb(h);
    await h.goto("/");
    await openFormAndFill(h, { name: "コバルトブルー", code: "C5", hex: "#1f4ea3" });
    await h.clickText("パレットに追加");
    await h.wait(300);
    await h.goto("/"); // リロード相当
    await h.wait(300);
    const names = await paletteNames(h);
    if (!names.includes("コバルトブルー")) {
      throw new Error(`リロード後にデータが消えています: ${JSON.stringify(names)}`);
    }
    h.note("リロードしても持ち色が残る");
  },

  /** スマートフォンの幅でも崩れない。 */
  mobile: async (h) => {
    await h.viewport(375, 720);
    await h.goto("/");
    await clearDb(h);
    await seed(h, [
      paint(1, { name: "レッド", code: "X-7", hex: "#c0392b" }),
      paint(2, { name: "ブルー", code: "C5", hex: "#1f4ea3" }),
      paint(3, { name: "イエロー", code: "C4", hex: "#f1c40f" }),
    ]);
    await h.goto("/");
    await h.expectNoHorizontalOverflow();
    h.note("375px幅で横スクロールなし");
  },
};

/**
 * デザイン確認用の画面（受入の合否には関与しない）。
 * 空のトップには「答え」が無い。この製品の主画面は持ち色が並んだパレットなので、
 * 多色を仕込んだ populated 状態と、暗い表示を撮る。
 */
export const designStates = {
  "main-populated": async (h) => {
    await h.goto("/");
    await clearDb(h);
    await seed(h, [
      paint(1, { brand: "Mr.カラー", name: "モンザレッド", code: "C68", hex: "#c8102e" }),
      paint(2, { brand: "Mr.カラー", name: "オレンジ", code: "C59", hex: "#e8752b" }),
      paint(3, { brand: "タミヤカラー アクリル", name: "イエロー", code: "X-8", hex: "#f2c31b" }),
      paint(4, { brand: "ガイアカラー", name: "ブライトグリーン", code: "022", hex: "#3ca55c" }),
      paint(5, { brand: "Mr.カラー", name: "コバルトブルー", code: "C5", hex: "#1f4ea3" }),
      paint(6, { brand: "ファレホ", name: "マゼンタ", code: "70.945", hex: "#a02c68" }),
      paint(7, { brand: "シタデルカラー", name: "パープル", code: "22-05", hex: "#5b3b8c" }),
      paint(8, { brand: "タミヤカラー エナメル", name: "フラットブラック", code: "XF-1", hex: "#20242a" }),
      paint(9, { brand: "Mr.カラー", name: "ホワイト", code: "C1", hex: "#f4f4f2" }),
    ]);
    await h.goto("/");
    await h.expectText("モンザレッド");
  },
  dark: async (h) => {
    await h.page.evaluate(() => {
      try {
        localStorage.setItem("pp-theme", "dark");
      } catch {
        /* noop */
      }
    });
    await h.goto("/");
    await h.wait(200);
  },
};
