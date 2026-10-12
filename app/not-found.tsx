import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "404 — ペイントパレット",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="page">
      <div className="tray-head" style={{ marginTop: 40 }}>
        <p className="section-eyebrow">404</p>
        <h1 className="section-title">ページが見つかりません</h1>
        <p className="section-lead">
          お探しのページは見つかりませんでした。ペイントパレットのトップに戻れます。
        </p>
        <p style={{ marginTop: 16 }}>
          <Link className="btn btn-primary" href="/">
            パレットへ戻る
          </Link>
        </p>
      </div>
    </div>
  );
}
