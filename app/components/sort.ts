// 並べ替えモードの表示定義（UI とロジックで同じ集合を使う）。
export type SortMode = "hue" | "recent" | "name" | "brand";

export const SORTS: { mode: SortMode; label: string }[] = [
  { mode: "hue", label: "色相順" },
  { mode: "recent", label: "追加順" },
  { mode: "name", label: "名前順" },
  { mode: "brand", label: "ブランド順" },
];
