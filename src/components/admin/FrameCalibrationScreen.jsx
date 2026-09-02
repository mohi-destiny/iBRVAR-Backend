import { useState, useRef } from "react";

// Reusable calibration screen — matches the "move/resize a red frame over a
// panorama feed" pattern used by Pit / T-60 / T-12 in the client's PDF spec.
export function FrameCalibrationScreen({ title, cameras }) {
  const [panoTab, setPanoTab] = useState("center");
  const [box, setBox] = useState({ x: 8, y: 15, w: 30, h: 55 }); // percentages
  const dragRef = useRef(null);
  const cam = cameras[0];

  const onMouseDown = (e, mode) => {
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY, box: { ...box } };
    dragRef.current = { mode, start };
    const onMove = (ev) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = ((ev.clientX - d.start.x) / 600) * 100;
      const dy = ((ev.clientY - d.start.y) / 340) * 100;
      setBox((prev) => {
        if (d.mode === "move") return { ...prev, x: Math.max(0, Math.min(100 - prev.w, d.start.box.x + dx)), y: Math.max(0, Math.min(100 - prev.h, d.start.box.y + dy)) };
        return { ...prev, w: Math.max(5, Math.min(100 - prev.x, d.start.box.w + dx)), h: Math.max(5, Math.min(100 - prev.y, d.start.box.h + dy)) };
      });
    };
    const onUp = () => { dragRef.current = null; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div className="bg-zinc-950 text-zinc-100 p-4 rounded-lg border border-zinc-800">
      <h2 className="text-sm font-semibold mb-3">{title}</h2>
      <div className="flex gap-1.5 mb-3">
        {[["center", "センターパノラマ"], ["1m", "1Mパノラマ"], ["2m", "2Mパノラマ"]].map(([k, l]) => (
          <button key={k} onClick={() => setPanoTab(k)} className={`text-xs px-3 py-1.5 rounded border ${panoTab === k ? "bg-cyan-500 text-zinc-950 border-cyan-500" : "bg-zinc-900 text-zinc-400 border-zinc-800"}`}>{l}</button>
        ))}
      </div>
      <div className="relative bg-black rounded overflow-hidden select-none" style={{ aspectRatio: "600/340" }}>
        {cam ? (
          <video autoPlay muted playsInline className="w-full h-full object-cover pointer-events-none" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">no camera set — add one from Live Cameras</div>
        )}
        <div
          onMouseDown={(e) => onMouseDown(e, "move")}
          className="absolute border-2 border-red-500 cursor-move"
          style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` }}
        >
          <div onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e, "resize"); }} className="absolute -right-1.5 -bottom-1.5 w-3 h-3 bg-red-500 rounded-full cursor-nwse-resize" />
        </div>
      </div>
      <p className="text-[11px] text-zinc-600 mt-2">Move and define the field of view frame position with the mouse.</p>
      <div className="flex justify-end gap-2 mt-4">
        <button className="px-4 py-1.5 rounded border border-cyan-500 text-cyan-400 text-xs">キャンセル</button>
        <button className="px-4 py-1.5 rounded bg-cyan-500 text-zinc-950 text-xs font-medium">確定</button>
      </div>
    </div>
  );
}
