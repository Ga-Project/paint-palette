"use client";

import type { SortMode } from "./sort";
import { SORTS } from "./sort";

type FilterRailProps = {
  brands: string[];
  brand: string;
  sort: SortMode;
  query: string;
  onBrand: (v: string) => void;
  onSort: (v: SortMode) => void;
  onQuery: (v: string) => void;
};

/** 並べ替え・ブランド絞り込み・検索の薄い水平レール（縦積みセクションにしない）。 */
export default function FilterRail({
  brands,
  brand,
  sort,
  query,
  onBrand,
  onSort,
  onQuery,
}: FilterRailProps) {
  return (
    <div className="filter-rail" role="group" aria-label="並べ替えと絞り込み">
      <div className="seg" role="group" aria-label="並べ替え">
        {SORTS.map((s) => (
          <button
            key={s.mode}
            type="button"
            className="seg-btn"
            aria-pressed={sort === s.mode}
            onClick={() => onSort(s.mode)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <label className="field-inline">
        <span className="sr-only">ブランドで絞り込み</span>
        <select
          className="control"
          value={brand}
          onChange={(e) => onBrand(e.target.value)}
          aria-label="ブランドで絞り込み"
        >
          <option value="">すべてのブランド</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </label>

      <label className="field-inline filter-search">
        <span className="sr-only">色名・色番で検索</span>
        <input
          id="palette-search"
          className="control"
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="色名・色番で検索"
          style={{ width: "100%" }}
        />
      </label>
    </div>
  );
}
