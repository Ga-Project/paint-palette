"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";
const KEY = "pp-theme";

/**
 * 明暗の切替。初期値は OS 設定に従い、選択は localStorage に残す。
 * static export のためマウント後にだけ data-theme を確定させ、ハイドレーション不整合を避ける。
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    let initial: Theme;
    try {
      const saved = localStorage.getItem(KEY);
      initial =
        saved === "light" || saved === "dark"
          ? saved
          : window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
    } catch {
      initial = "light";
    }
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* 保存できなくても切替は効かせる */
    }
  }

  // マウント前は中立ラベルで場所だけ確保（レイアウトのちらつき防止）。
  const label =
    theme === null
      ? "表示切替"
      : theme === "dark"
        ? "ライトにする"
        : "ダークにする";

  return (
    <button
      type="button"
      id="theme-toggle"
      className="btn btn-ghost"
      onClick={toggle}
      aria-label={label}
      title={label}
    >
      <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
    </button>
  );
}
