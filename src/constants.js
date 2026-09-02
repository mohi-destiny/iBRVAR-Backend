// Single source of truth for values used across the app.
export const CAMERA_SERVER = "http://localhost:4000";
export const DEFAULT_DELAY_S = 10;

// Fixed credentials for now, per instruction — swap this for a real auth
// backend later. Each entry maps 1:1 to a role.
export const CREDENTIALS = {
  admin: { password: "admin123", role: "admin", label: "Admin" },
  referee1: { password: "ref1pass", role: "referee1", label: "Referee 1 (主審)" },
  referee2: { password: "ref2pass", role: "referee2", label: "Referee 2 (副審)" },
};

// The 5 monitor layout patterns from the client spec.
export const TEMPLATES = {
  single: { label: "Single", slots: 1, grid: "grid-cols-1 grid-rows-1" },
  quad: { label: "2×2", slots: 4, grid: "grid-cols-2 grid-rows-2" },
  nine: { label: "3×3", slots: 9, grid: "grid-cols-3 grid-rows-3" },
  sixteen: { label: "4×4", slots: 16, grid: "grid-cols-4 grid-rows-4" },
  splitH: { label: "Top / Bottom", slots: 2, grid: "grid-cols-1 grid-rows-2" },
  topSplit: { label: "Top split + Bottom", slots: 3, grid: "grid-cols-2 grid-rows-2", spans: { 2: "col-span-2" } },
};
export const TEMPLATE_OPTIONS = Object.entries(TEMPLATES).map(([k, t]) => [k, t.label]);

export const RACE_TABS = ["レース", "模擬レース", "前日検査", "スタート練習"];

export const TIMELINE_MARKERS = ["発走", "待機", "スタート", "1-1M", "1-BS", "1-2M", "2-1M", "2-BS", "2-2M", "3-1M", "3-BS", "3-2M", "ゴール"];
export const HIGHLIGHT_MARKERS = new Set(["発走", "1-BS", "2-BS", "3-BS"]);

export const ACCESS_MODULES = ["設定", "録画", "再生", "モニタ構成"];
export const DEFAULT_ACCESS = {
  admin: { 設定: true, 録画: true, 再生: true, モニタ構成: true },
  referee1: { 設定: false, 録画: true, 再生: false, モニタ構成: false },
  referee2: { 設定: false, 録画: false, 再生: true, モニタ構成: true },
};

export const SESSION_KEY = "ibrvar_session";
export const SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000; // 1 day

export function accentFor(id) {
  const hue = (id * 47) % 360;
  return { solid: `hsl(${hue}, 75%, 60%)`, soft: `hsl(${hue}, 75%, 60%, 0.15)`, border: `hsl(${hue}, 75%, 60%, 0.4)` };
}

export function fmtClock(ms) {
  const s = Math.max(0, ms / 1000);
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1).padStart(4, "0");
  return `${String(m).padStart(2, "0")}:${sec}`;
}