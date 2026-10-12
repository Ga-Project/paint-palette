"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { normalizeHex, readableInk } from "../../lib/color.mjs";
import {
  BRAND_PRESETS,
  FREE_CAP,
  canAdd,
  findDuplicate,
  validatePaintInput,
} from "../../lib/paints.mjs";
import type { Paint } from "../../lib/paints.mjs";

type AddPaintDrawerProps = {
  open: boolean;
  count: number;
  paints: Paint[];
  onClose: () => void;
  // 保存の成否を返す。false（保存失敗・上限）のときフォームは入力を保持する。
  onAdd: (fields: {
    brand: string;
    name: string;
    code: string;
    hex: string;
  }) => Promise<boolean>;
};

const OTHER = "その他";

/** ダブのプレビュー（塗料色のベタ塗り＋濡れ表現・クリック不可）。 */
function PreviewChip({ hex }: { hex: string }) {
  const style = {
    "--dab-fill": hex,
    "--dab-ink": readableInk(hex),
  } as CSSProperties;
  return <div className="dab-chip" style={style} aria-hidden="true" />;
}

export default function AddPaintDrawer({
  open,
  count,
  paints,
  onClose,
  onAdd,
}: AddPaintDrawerProps) {
  const [brandPreset, setBrandPreset] = useState<string>(
    BRAND_PRESETS[0] ?? OTHER,
  );
  const [brandFree, setBrandFree] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [hexText, setHexText] = useState("#c8102e");
  const [error, setError] = useState<{ field: string; message: string } | null>(
    null,
  );
  const [dupeAck, setDupeAck] = useState(false);

  const titleId = useId();
  const firstFieldRef = useRef<HTMLSelectElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  // 開いたら先頭フィールドへフォーカスし、閉じるときに入力を初期化する。
  useEffect(() => {
    if (open) {
      setError(null);
      setDupeAck(false);
      const t = setTimeout(() => firstFieldRef.current?.focus(), 20);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open]);

  // Escape で閉じる。Tab はドロワー内に閉じ込める（背後の隠れた操作要素へ抜けない）。
  // aria-modal を宣言している以上、フォーカスがダイアログ外へ出ないことまで保証する。
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const root = drawerRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault();
          last?.focus();
        }
      } else if (active === last || !root.contains(active)) {
        e.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // 入力（ブランド/色名/色番）を変えたら重複の承知を取り消す。
  // 重複Aを承知したあと別の重複Bに書き換えて再警告なしに追加できてしまうのを防ぐ。
  useEffect(() => {
    setDupeAck(false);
  }, [brandPreset, brandFree, name, code]);

  if (!open) return null;

  const brand = brandPreset === OTHER ? brandFree.trim() : brandPreset;
  const previewHex = normalizeHex(hexText) ?? "#888888";
  const atCap = !canAdd(count);
  const candidate = { brand, name: name.trim(), code: code.trim() };
  const duplicate = name.trim() ? findDuplicate(paints, candidate) : null;

  function reset() {
    setName("");
    setCode("");
    setHexText("#c8102e");
    setDupeAck(false);
    setError(null);
  }

  async function submit() {
    const v = validatePaintInput({ brand, name, code, hex: hexText });
    if (!v.ok) {
      setError({ field: v.field, message: v.error });
      return;
    }
    setError(null);
    if (duplicate && !dupeAck) {
      setDupeAck(true); // 重複警告を出す。もう一度押されたら承知で登録。
      return;
    }
    // 保存が成功したときだけフォームを初期化する。失敗時は入力を保持して再試行できるようにする。
    const ok = await onAdd(v.value);
    if (ok) {
      reset();
    } else {
      setError({
        field: "",
        message:
          "保存できませんでした。入力はそのままです。もう一度お試しください。",
      });
    }
  }

  return (
    <>
      <div className="backdrop" onClick={onClose} aria-hidden="true" />
      <aside
        ref={drawerRef}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="drawer-head">
          <h2 className="drawer-title" id={titleId}>
            塗料を登録
          </h2>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            閉じる
          </button>
        </div>

        <div className="drawer-body">
          {atCap ? (
            <div className="cap-note" role="status">
              <p>
                <b>無料版の上限 {FREE_CAP} 色に達しました。</b>
              </p>
              <p style={{ marginTop: 6 }}>
                新しい色を登録するには、使わない色をパレットから削除してください。
              </p>
            </div>
          ) : (
            <>
              <div className="slip-preview">
                <PreviewChip hex={previewHex} />
                <div>
                  <div className="dab-name">{name.trim() || "（色名）"}</div>
                  <div className="dab-meta num">
                    {[brand, code.trim()].filter(Boolean).join("・") ||
                      previewHex}
                  </div>
                  <p className="slip-note" style={{ marginTop: 6 }}>
                    画面の色は実際の塗料と異なる場合があります。
                  </p>
                </div>
              </div>

              {duplicate ? (
                <div className="callout callout-alert" role="alert">
                  <div className="callout-title">
                    <span aria-hidden="true">⚠</span> すでに持っています
                  </div>
                  <div className="callout-body">
                    このブランド×色番はコレクションにあります:{" "}
                    <b>
                      {duplicate.name}
                      {duplicate.code ? `（${duplicate.code}）` : ""}
                    </b>
                  </div>
                  <div className="dupe-compare">
                    <div className="dupe-col">
                      <PreviewChip hex={duplicate.hex} />
                      持っている色
                    </div>
                    <div className="dupe-col">
                      <PreviewChip hex={previewHex} />
                      今の入力
                    </div>
                  </div>
                </div>
              ) : null}

              <label className="field">
                <span className="field-label">ブランド</span>
                <select
                  ref={firstFieldRef}
                  id="paint-brand"
                  className="control"
                  value={brandPreset}
                  onChange={(e) => setBrandPreset(e.target.value)}
                >
                  {BRAND_PRESETS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>

              {brandPreset === OTHER ? (
                <label className="field">
                  <span className="field-label">ブランド名（自由入力）</span>
                  <input
                    className="control"
                    value={brandFree}
                    onChange={(e) => setBrandFree(e.target.value)}
                    placeholder="例: ○○カラー"
                  />
                </label>
              ) : null}

              <div className="field-row">
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="field-label">
                    色名<span className="req">*</span>
                  </span>
                  <input
                    id="paint-name"
                    className="control"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="例: ミッドナイトブルー"
                    aria-invalid={error?.field === "name"}
                  />
                </label>
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="field-label">色番</span>
                  <input
                    id="paint-code"
                    className="control num"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="例: C5 / X-7"
                  />
                </label>
              </div>

              <label className="field" style={{ marginTop: 14 }}>
                <span className="field-label">
                  色<span className="req">*</span>
                </span>
                <div className="field-color">
                  <input
                    type="color"
                    value={normalizeHex(hexText) ?? "#888888"}
                    onChange={(e) => setHexText(e.target.value)}
                    aria-label="色を選ぶ"
                  />
                  <input
                    id="paint-hex"
                    type="text"
                    className="num"
                    value={hexText}
                    onChange={(e) => setHexText(e.target.value)}
                    placeholder="#RRGGBB"
                    aria-invalid={error?.field === "hex"}
                    inputMode="text"
                  />
                </div>
              </label>

              {error ? <p className="field-error">{error.message}</p> : null}

              <div className="form-actions">
                {duplicate && dupeAck ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => void submit()}
                    >
                      重複を承知で登録
                    </button>
                    <button type="button" className="btn" onClick={onClose}>
                      やめる
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void submit()}
                  >
                    パレットに追加
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
