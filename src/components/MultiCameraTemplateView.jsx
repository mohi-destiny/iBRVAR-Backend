import { useState, useEffect, useCallback } from "react";
import { Layers, History, Repeat, RotateCcw } from "lucide-react";
import { VideoTile } from "./shared/VideoTile";
import { TEMPLATES, DEFAULT_DELAY_S } from "../constants";

// 1) Multi-camera template view — pick a layout, assign a set of cameras to
// it, and control Live/Delay/recorded-playback for the WHOLE set at once.
export function MultiCameraTemplateView({ cameras, lockedTemplate, sharedDelaySeconds, monitorNum, slotCameraNames }) {
  const [templateKey, setTemplateKey] = useState(lockedTemplate || "quad");
  const [delaySeconds, setDelaySeconds] = useState(sharedDelaySeconds || DEFAULT_DELAY_S);
  const [groupMode, setGroupMode] = useState({ type: "live", offset: 0, nonce: 0 });
  const [playbackSource, setPlaybackSource] = useState(null); // {date,type,race,count} or null for live
  const [playbackCommand, setPlaybackCommand] = useState(null); // {action, value, nonce}

  useEffect(() => { if (lockedTemplate) setTemplateKey(lockedTemplate); }, [lockedTemplate]);
  useEffect(() => { if (sharedDelaySeconds) setDelaySeconds(sharedDelaySeconds); }, [sharedDelaySeconds]);

  const template = TEMPLATES[templateKey];
  const slots = Array.from({ length: template.slots }, (_, i) => {
    const assignedName = slotCameraNames?.[i];
    if (assignedName) return cameras.find((c) => c.name === assignedName) || null;
    return slotCameraNames ? null : (cameras[i] || null); // if an assignment array exists but this slot is empty, leave it empty rather than guessing
  });

  const setGroupLive = useCallback(() => { setPlaybackSource(null); setGroupMode((m) => ({ type: "live", offset: 0, nonce: m.nonce + 1 })); }, []);
  const setGroupDelay = useCallback(() => { setPlaybackSource(null); setGroupMode((m) => ({ type: "continuous", offset: delaySeconds, nonce: m.nonce + 1 })); }, [delaySeconds]);
  const setGroupLoop = useCallback(() => { setPlaybackSource(null); setGroupMode((m) => ({ type: "loop", offset: delaySeconds, nonce: m.nonce + 1 })); }, [delaySeconds]);

  // Listen for keyboard/device commands and Referee 2's search/transport
  // controls, broadcast from anywhere, targeted at this specific monitor.
  useEffect(() => {
    if (!monitorNum) return;
    let bc;
    try { bc = new BroadcastChannel("ibrvar-control"); } catch { return; }
    bc.onmessage = (e) => {
      const cmd = e.data;
      if (cmd.monitor !== monitorNum && cmd.monitor !== "all") return;
      if (cmd.type === "live") setGroupLive();
      else if (cmd.type === "delay") setGroupDelay();
      else if (cmd.type === "intentionalDelay") setGroupLoop();
      else if (cmd.type === "loadRace") setPlaybackSource({ date: cmd.date, type: cmd.type_, race: cmd.race, count: cmd.count });
      else if (cmd.type === "playbackControl") setPlaybackCommand({ action: cmd.action, value: cmd.value, nonce: Date.now() });
    };
    return () => bc.close();
  }, [monitorNum, setGroupLive, setGroupDelay, setGroupLoop]);

  return (
    <div className="bg-zinc-950 text-zinc-100 p-4 rounded-lg border border-zinc-800">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold">Camera set — template view{monitorNum ? ` (Monitor ${monitorNum})` : ""}</h2>
          {playbackSource && (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
              playing recording: {playbackSource.date} · {playbackSource.type} · {playbackSource.race} · #{playbackSource.count}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number" min={1} max={60} value={delaySeconds}
            onChange={(e) => setDelaySeconds(Number(e.target.value) || DEFAULT_DELAY_S)}
            className="w-16 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs font-mono"
          />
          <button
            onClick={setGroupDelay}
            className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded font-medium transition ${groupMode.type === "continuous" && !playbackSource ? "bg-violet-500 text-zinc-950" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}
          >
            <History className="w-3.5 h-3.5" /> Delay all (−{delaySeconds}s)
          </button>
          <button
            onClick={setGroupLoop}
            className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded font-medium transition ${groupMode.type === "loop" && !playbackSource ? "bg-amber-500 text-zinc-950" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}
          >
            <Repeat className="w-3.5 h-3.5" /> Intentional delay
          </button>
          <button
            onClick={setGroupLive}
            className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded font-medium transition ${groupMode.type === "live" && !playbackSource ? "bg-cyan-500 text-zinc-950" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}
          >
            <RotateCcw className="w-3.5 h-3.5" /> Live all
          </button>
        </div>
      </div>

      {!lockedTemplate && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {Object.entries(TEMPLATES).map(([key, t]) => (
            <button
              key={key}
              onClick={() => setTemplateKey(key)}
              className={`text-xs px-2.5 py-1 rounded border transition ${templateKey === key ? "bg-cyan-500 text-zinc-950 border-cyan-500" : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className={`grid ${template.grid} gap-1.5`} style={{ aspectRatio: "16/9" }}>
        {slots.map((cam, i) => (
          <div key={cam?.id ?? `empty-${i}`} className={template.spans?.[i] || ""}>
            <VideoTile cam={cam} groupMode={groupMode} delaySeconds={delaySeconds} playbackSource={playbackSource} playbackCommand={playbackCommand} />
          </div>
        ))}
      </div>
      <p className="text-[11px] text-zinc-600 mt-2">
        "Delay all" / "Intentional delay" / "Live all" moves every tile in this template together, in one click. When a recording is loaded (from Referee 2's search), every tile shows that race's clip for its own assigned camera.
      </p>
    </div>
  );
}