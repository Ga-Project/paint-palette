"use client";

import type { CSSProperties } from "react";
import { readableInk } from "../../lib/color.mjs";
import type { Paint } from "../../lib/paints.mjs";

type DabProps = {
  paint: Paint;
  selected?: boolean;
  isNew?: boolean;
  onToggle?: (id: string) => void;
  onDelete?: (id: string) => void;
};

/**
 * 1色の塗料ダブ。塗料色をベタ塗りし、上に載せる色番チップだけ輝度で黒/白を自動選択する。
 * 色名・ブランド・色番はダブ下（既知コントラストの面）に併記し、色だけに依存させない。
 */
export default function Dab({
  paint,
  selected,
  isNew,
  onToggle,
  onDelete,
}: DabProps) {
  const ink = readableInk(paint.hex);
  const style = {
    "--dab-fill": paint.hex,
    "--dab-ink": ink,
  } as CSSProperties;

  const meta = [paint.brand, paint.code].filter(Boolean).join("・");

  return (
    <div className={`dab${isNew ? " is-new" : ""}`}>
      <button
        type="button"
        className="dab-chip"
        style={style}
        aria-pressed={selected ? true : false}
        aria-label={`${paint.name}${meta ? `（${meta}）` : ""} — 操作する`}
        onClick={() => onToggle?.(paint.id)}
      >
        {paint.code ? (
          <span className="dab-code num" aria-hidden="true">
            {paint.code}
          </span>
        ) : null}
      </button>
      <div className="dab-label">
        <div className="dab-name">{paint.name}</div>
        {meta ? (
          <div className="dab-meta num">{meta}</div>
        ) : (
          <div className="dab-meta num">{paint.hex}</div>
        )}
      </div>
      {selected ? (
        <div className="form-actions" style={{ marginTop: 2 }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => onDelete?.(paint.id)}
          >
            削除
          </button>
        </div>
      ) : null}
    </div>
  );
}
