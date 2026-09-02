import { useRef, useEffect } from "react";
import { Terminal } from "lucide-react";

export function CpuLog({ entries }) {
  const boxRef = useRef(null);
  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [entries.length]);
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800">
        <Terminal className="w-3.5 h-3.5 text-zinc-500" />
        <p className="text-xs text-zinc-400 font-medium">Delay seek timing</p>
        <span className="text-xs text-zinc-600">— logs every time a Delay/Resync click seeks a camera</span>
      </div>
      <div ref={boxRef} className="h-40 overflow-y-auto px-3 py-2 font-mono text-xs space-y-1">
        {entries.length === 0 && <p className="text-zinc-600">Click Delay on a camera to see seek timing here…</p>}
        {entries.map((e) => (
          <div key={e.key} className="flex items-center gap-2 text-zinc-400">
            <span className="text-zinc-600">{e.time}</span>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: e.accent }} />
            <span style={{ color: e.accent }}>{e.name}</span>
            <span className="text-zinc-500">{e.label}</span>
            <span className={e.ms > 200 ? "text-amber-400" : "text-zinc-500"}>{e.ms.toFixed(0)}ms</span>
          </div>
        ))}
      </div>
    </div>
  );
}
