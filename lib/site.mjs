// site.mjs — 公開先の場所。sitemap と canonical が同じ値を見るための単一の出どころ。
//
// サブパス配信（<owner>.github.io/paint-palette/）ではビルド時に basePath が注入される。
// sitemap の URL と canonical がこれを取りこぼすと、実在しない URL を検索エンジンに
// 申告することになるので、両者で同じ定数を使う。

/** ビルド時に注入されるサブパス（未設定ならルート配信）。 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** 公開先のオリジン。 */
export const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_ORIGIN || "https://ga-project.github.io";

/** 絶対 URL を組み立てる。 */
export function absoluteUrl(path = "/") {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_ORIGIN}${BASE_PATH}${normalized}`;
}
