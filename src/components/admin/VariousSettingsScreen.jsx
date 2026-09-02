import { useState } from "react";

// 各種設定 — Various Settings, matching the PDF's field list exactly.
export function VariousSettingsScreen({ config, updateConfig }) {
  const [local, setLocal] = useState({
    venue: config.venue, liveDelay: config.delaySeconds, maxRaces: config.maxRaces, repeatSeconds: 7,
    fleetTrackingSize: "1/2", lineMarkerCamera: "R,L,P", superimpose: "XXX",
    displayLatency: config.displayLatencySeconds ?? 5,
  });
  const [saved, setSaved] = useState(false);
  const set = (k, v) => { setLocal((s) => ({ ...s, [k]: v })); setSaved(false); };

  const save = () => {
    updateConfig({
      delaySeconds: Number(local.liveDelay) || 10,
      maxRaces: Number(local.maxRaces) || 12,
      venue: local.venue,
      displayLatencySeconds: Number(local.displayLatency) || 0,
    });
    setSaved(true);
  };

  return (
    <div className="bg-zinc-950 text-zinc-100 p-4 rounded-lg border border-zinc-800 max-w-md">
      <h2 className="text-sm font-semibold mb-4">各種設定 — Various Settings</h2>
      {[
        ["venue", "レース場 (Venue)", "text"],
        ["maxRaces", "レース最大数 (Max races) — shared with all panels", "number"],
        ["liveDelay", "ライブ遅延時間 (Live delay, s) — shared with all panels", "number"],
        ["repeatSeconds", "リピート再生時間 (Repeat playback, s)", "number"],
        ["displayLatency", "Live display latency (s) — subtracted from every race recording's start/end so the saved clip matches what was on screen at click time. Measure once, then set here.", "number"],
        ["fleetTrackingSize", "艇団追尾映像サイズ (Fleet tracking size)", "text"],
        ["lineMarkerCamera", "ラインマーカーカメラ (Line marker camera)", "text"],
        ["superimpose", "スーパーインポーズ (Superimpose) — content TBD w/ JPF", "text"],
      ].map(([key, label, type]) => (
        <div key={key} className="mb-3">
          <label className="text-xs text-zinc-500 block mb-1">{label}</label>
          <input type={type} value={local[key]} onChange={(e) => set(key, e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-sm font-mono" />
        </div>
      ))}
      <button onClick={save} className="mt-2 bg-cyan-500 text-zinc-950 text-xs font-medium px-4 py-2 rounded">確定</button>
      {saved && <p className="text-[11px] text-teal-400 mt-2">Saved — live delay and max races now apply everywhere (Live Cameras, Recording, Referee panels).</p>}
    </div>
  );
}