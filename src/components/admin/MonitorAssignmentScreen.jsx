import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { TEMPLATES, TEMPLATE_OPTIONS } from "../../constants";

// モニタ構成定義 — admin sets HOW MANY physical monitors exist, then assigns
// one of the layout patterns (and exactly which camera fills each slot) to
// each one. Referees just view whatever's assigned here.
export function MonitorAssignmentScreen({ config, updateConfig, cameras }) {
  const [saved, setSaved] = useState(false);
  const monitorCount = config.monitorCount || 4;
  const monitorNumbers = Array.from({ length: monitorCount }, (_, i) => i + 1);

  const setMonitorCount = (n) => {
    updateConfig({ monitorCount: Math.max(1, Math.min(16, n)) });
    setSaved(true);
  };
  const setTemplate = (n, value) => {
    updateConfig({ monitorTemplates: { ...config.monitorTemplates, [n]: value } });
    setSaved(true);
  };
  const setSlotCamera = (n, slotIndex, camName) => {
    const current = config.monitorCameraAssignments?.[n] || [];
    const next = [...current];
    next[slotIndex] = camName || null;
    updateConfig({ monitorCameraAssignments: { ...config.monitorCameraAssignments, [n]: next } });
    setSaved(true);
  };

  return (
    <div className="bg-zinc-950 text-zinc-100 p-4 rounded-lg border border-zinc-800 max-w-2xl">
      <h2 className="text-sm font-semibold mb-1">モニタ構成定義 — Monitor Configuration</h2>
      <p className="text-[11px] text-zinc-500 mb-4">Choose each monitor's layout, and exactly which camera fills each slot in that layout. Referee panels display exactly this — they don't pick their own layout or cameras.</p>

      <div className="flex items-center gap-2 mb-4 bg-zinc-900 border border-zinc-800 rounded-lg p-3">
        <label className="text-sm text-zinc-300">Number of monitors</label>
        <button onClick={() => setMonitorCount(monitorCount - 1)} disabled={monitorCount <= 1} className="p-1.5 rounded bg-zinc-800 text-zinc-300 disabled:opacity-40"><Trash2 className="w-3.5 h-3.5" /></button>
        <span className="text-sm font-mono w-6 text-center">{monitorCount}</span>
        <button onClick={() => setMonitorCount(monitorCount + 1)} disabled={monitorCount >= 16} className="p-1.5 rounded bg-cyan-500 text-zinc-950 disabled:opacity-40"><Plus className="w-3.5 h-3.5" /></button>
        <span className="text-[11px] text-zinc-600 ml-2">Removing a monitor doesn't delete its saved layout — add it back and the settings return.</span>
      </div>

      {monitorNumbers.map((n) => {
        const templateKey = config.monitorTemplates[n] || "single";
        const slotCount = TEMPLATES[templateKey]?.slots || 1;
        const assignment = config.monitorCameraAssignments?.[n] || [];
        return (
          <div key={n} className="mb-5 pb-5 border-b border-zinc-800 last:border-0">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-zinc-200">Monitor {n}</label>
              <select value={templateKey} onChange={(e) => setTemplate(n, e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-sm">
                {TEMPLATE_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: slotCount }, (_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[11px] text-zinc-500 w-14 shrink-0">Slot {i + 1}</span>
                  <select
                    value={assignment[i] || ""}
                    onChange={(e) => setSlotCamera(n, i, e.target.value)}
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs"
                  >
                    <option value="">— empty —</option>
                    {cameras.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {saved && <p className="text-[11px] text-teal-400 mt-2">Saved — takes effect on referee panels and display tabs within their next poll (~5s).</p>}
      {cameras.length === 0 && <p className="text-[11px] text-amber-400 mt-2">No cameras are running yet — add some from "Live Cameras" first.</p>}
    </div>
  );
}