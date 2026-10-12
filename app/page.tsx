"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FREE_CAP,
  brandsInUse,
  canAdd,
  filterPaints,
  makePaint,
  remaining,
  sortPaints,
} from "../lib/paints.mjs";
import type { Paint } from "../lib/paints.mjs";
import {
  deletePaint,
  getAllPaints,
  putIfUnderCap,
  storageAvailable,
} from "../lib/storage.mjs";
import Dab from "./components/Dab";
import AddPaintDrawer from "./components/AddPaintDrawer";
import FilterRail from "./components/FilterRail";
import ThemeToggle from "./components/ThemeToggle";
import type { SortMode } from "./components/sort";

type Status = "loading" | "ready" | "error";

/** 端末内で一意な id を発行（対応環境では randomUUID、無ければ時刻＋乱数）。 */
function newId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID)
      return crypto.randomUUID();
  } catch {
    /* fallthrough */
  }
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function Home() {
  const [paints, setPaints] = useState<Paint[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [sort, setSort] = useState<SortMode>("hue");
  const [brand, setBrand] = useState("");
  const [query, setQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newlyAdded, setNewlyAdded] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  async function load() {
    setStatus("loading");
    try {
      if (!storageAvailable()) throw new Error("no-storage");
      const all = await getAllPaints();
      setPaints(all);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const sync = () =>
      setOffline(typeof navigator !== "undefined" && !navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  // 追加直後の「濡れて落ち着く」ハイライトは一度だけ。
  // 並べ替え/絞り込みのあとまで is-new が残らないよう短時間で解除する。
  useEffect(() => {
    if (!newlyAdded) return undefined;
    const t = setTimeout(() => setNewlyAdded(null), 500);
    return () => clearTimeout(t);
  }, [newlyAdded]);

  const count = paints.length;
  const atCap = !canAdd(count);

  const visible = useMemo(
    () => sortPaints(filterPaints(paints, { brand, query }), sort),
    [paints, brand, query, sort],
  );
  const brands = useMemo(() => brandsInUse(paints), [paints]);
  const filtering = brand !== "" || query.trim() !== "";

  // ブランド順のときだけブランドで束ねる。他は華＝1枚のトレイに流す。
  const groups = useMemo(() => {
    if (sort !== "brand") return [{ name: "", items: visible }];
    const map = new Map<string, Paint[]>();
    for (const p of visible) {
      const key = p.brand || "（ブランド未設定）";
      const arr = map.get(key);
      if (arr) arr.push(p);
      else map.set(key, [p]);
    }
    return Array.from(map, ([name, items]) => ({ name, items }));
  }, [visible, sort]);

  // 成否を返す。保存に失敗/上限のときは false を返し、フォーム側は入力を保持する。
  async function handleAdd(fields: {
    brand: string;
    name: string;
    code: string;
    hex: string;
  }): Promise<boolean> {
    const paint = makePaint(fields, { id: newId(), addedAt: Date.now() });
    try {
      const res = await putIfUnderCap(paint, FREE_CAP);
      if (!res.ok) {
        // 上限（別タブが埋めた場合を含む）。実データで状態を同期し直して知らせる。
        await load();
        return false;
      }
      setPaints((prev) => [...prev, paint]);
      setNewlyAdded(paint.id);
      setStatus("ready");
      return true;
    } catch {
      setStatus("error");
      return false;
    }
  }

  async function handleDelete(id: string) {
    try {
      await deletePaint(id);
      const next = paints.filter((p) => p.id !== id);
      setPaints(next);
      // 絞り込み中のブランドが全消えしたらフィルタを解除（誤った0件表示を防ぐ）。
      if (brand && !next.some((p) => p.brand === brand)) setBrand("");
      setSelectedId((cur) => (cur === id ? null : cur));
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="page">
      <header className="bench-rail">
        <div className="wordmark">
          <span className="wordmark-mark" aria-hidden="true" />
          <span className="wordmark-text">
            ペイントパレット
            <span className="wordmark-sub">wet palette</span>
          </span>
        </div>

        <div className="capacity" aria-label={`登録 ${count} / ${FREE_CAP} 色`}>
          <span className="capacity-label">持ち色</span>
          <span className={`capacity-count num${atCap ? " is-full" : ""}`}>
            {count}
            <span aria-hidden="true"> / {FREE_CAP}</span>
          </span>
          <span className="capacity-bar" aria-hidden="true">
            <span
              className={`capacity-fill${atCap ? " is-full" : ""}`}
              style={{ width: `${Math.min(100, (count / FREE_CAP) * 100)}%` }}
            />
          </span>
        </div>

        <ThemeToggle />
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setDrawerOpen(true)}
        >
          ＋ 塗料を登録
        </button>
      </header>

      {status === "error" ? (
        <div className="banner" role="alert">
          <span className="banner-text">
            <b>保存領域を読み書きできませんでした。</b>{" "}
            プライベートブラウズ等で無効になっている可能性があります。
          </span>
          <button type="button" className="btn" onClick={() => void load()}>
            再試行
          </button>
        </div>
      ) : null}

      {offline ? (
        <div
          className="banner"
          role="status"
          style={{ borderColor: "var(--border-control)" }}
        >
          <span className="banner-text">
            オフラインで表示中です。データはこの端末に保存されています。
          </span>
        </div>
      ) : null}

      <div className="tray-head">
        <p className="section-eyebrow">持ち色パレット</p>
        <h1 className="section-title">その色、もう持ってる？</h1>
        <p className="section-lead">
          手持ちの塗料を登録すると、同じ色を買いそうになったとき重複を知らせ、持ち色を
          スウォッチのパレットで見渡せます。データはこの端末のブラウザにだけ保存されます。
        </p>
      </div>

      <FilterRail
        brands={brands}
        brand={brand}
        sort={sort}
        query={query}
        onBrand={setBrand}
        onSort={setSort}
        onQuery={setQuery}
      />

      <main id="bench" className="well" aria-live="polite">
        {status === "loading" ? (
          <div className="dabs" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <span className="skeleton-dab" key={i} />
            ))}
          </div>
        ) : count === 0 ? (
          <div className="well-empty">
            <div className="ghost-dabs" aria-hidden="true">
              <span className="ghost-dab" />
              <span className="ghost-dab" />
              <span className="ghost-dab" />
            </div>
            <p className="well-empty-text">
              <strong>まだ塗料がありません。</strong>
              <br />
              最初の1色を登録すると、ここに持ち色のパレットが並びます。
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setDrawerOpen(true)}
            >
              ＋ 塗料を登録
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="well-noresult">
            <p>条件に合う塗料はありません。</p>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setBrand("");
                setQuery("");
              }}
            >
              絞り込みを解除
            </button>
          </div>
        ) : (
          groups.map((g) => (
            <section className="well-group" key={g.name || "_all"}>
              {g.name ? (
                <div className="well-group-head">
                  <span className="well-group-name">{g.name}</span>
                  <span className="well-group-count num">
                    {g.items.length}色
                  </span>
                </div>
              ) : null}
              <div className="dabs">
                {g.items.map((p) => (
                  <Dab
                    key={p.id}
                    paint={p}
                    selected={selectedId === p.id}
                    isNew={newlyAdded === p.id}
                    onToggle={(id) =>
                      setSelectedId((cur) => (cur === id ? null : id))
                    }
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      {status === "ready" && count > 0 ? (
        <p
          className="section-lead"
          style={{ margin: "12px 2px 0", fontSize: "0.8125rem" }}
        >
          残り {remaining(count)} 色まで登録できます（無料版）。
          {filtering ? `　表示中: ${visible.length} 色` : ""}
        </p>
      ) : null}

      <footer className="footer">
        <p>
          ブランド名・色名・色番はメーカーを識別するための表記で、本サービスは各メーカーの
          公式・提携サービスではありません（メーカー非公式）。
        </p>
        <p>
          画面に表示される色は、光源・モニタ・塗膜により実際の塗料と異なります。塗装前に必ず
          実物でご確認ください。
        </p>
        <p>
          登録した塗料はこの端末のブラウザ（IndexedDB）にのみ保存され、サーバには送信されません。
        </p>
      </footer>

      <AddPaintDrawer
        open={drawerOpen}
        count={count}
        paints={paints}
        onClose={() => setDrawerOpen(false)}
        onAdd={handleAdd}
      />
    </div>
  );
}
