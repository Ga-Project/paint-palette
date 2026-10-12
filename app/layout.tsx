import type { Metadata } from "next";
import type { ReactNode } from "react";
import { absoluteUrl } from "../lib/site.mjs";
import "./globals.css";

const TITLE = "ペイントパレット — 模型塗料の在庫＆持ち色パレット";
const DESCRIPTION =
  "ガンプラ・ミニチュア・模型塗装のための塗料在庫管理。持っている塗料をブランド・色名・色番で登録すると、同じ色を買いそうになったとき重複を知らせ、手持ちの色をスウォッチのパレットで一覧できます。データはこの端末のブラウザにだけ保存され、アカウント登録は不要です。";

export const metadata: Metadata = {
  metadataBase: new URL(absoluteUrl("/")),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: absoluteUrl("/") },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: absoluteUrl("/"),
    type: "website",
    locale: "ja_JP",
    siteName: "ペイントパレット",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>
        {/* アクセス解析（cookieless・秘密キー不要）: 全プロダクト共通の単一 GoatCounter サイト
            「ga-project」に集約する。製品ごとの数値は path（/paint-palette/）で区別されるので、
            GoatCounter 側でサイトを新規作成しない＝新プロダクトは自動で ga-project の新パスとして計測される。 */}
        <script
          data-goatcounter="https://ga-project.goatcounter.com/count"
          async
          src="//gc.zgo.at/count.js"
        />
        <a className="skip-link" href="#bench">
          パレットへ移動
        </a>
        {children}
      </body>
    </html>
  );
}
