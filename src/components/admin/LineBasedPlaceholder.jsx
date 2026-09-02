export function LineBasedPlaceholder({ title, cameras }) {
  const cam = cameras[0];
  return (
    <div className="bg-zinc-950 text-zinc-100 p-4 rounded-lg border border-zinc-800">
      <h2 className="text-sm font-semibold mb-3">{title}</h2>
      <div className="relative bg-black rounded overflow-hidden aspect-video mb-3 flex items-center justify-center">
        <p className="text-zinc-600 text-xs">{cam ? "line-based calibration UI — coming soon" : "no camera set"}</p>
      </div>
      <p className="text-[11px] text-zinc-600">This screen needs multi-segment draggable lines (発走 / バックストレッチ / 1M / 2M / スタート or line-marker segments) rather than a single frame — build this once the exact interaction is finalized.</p>
    </div>
  );
}
