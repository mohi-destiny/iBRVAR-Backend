import { useState } from "react";

export function SearchResultsModal({ results, onCancel, onConfirm }) {
  const [selected, setSelected] = useState(0);
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white text-zinc-900 rounded-xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <div className="grid grid-cols-5 gap-2 text-sm font-medium text-zinc-500 pb-2 border-b border-zinc-200">
          <span>選択</span><span>日付</span><span>種別</span><span>レース番号</span><span>回数</span>
        </div>
        {results.map((r, i) => (
          <label key={i} className="grid grid-cols-5 gap-2 text-sm py-3 border-b border-zinc-100 cursor-pointer items-center">
            <input type="radio" checked={selected === i} onChange={() => setSelected(i)} className="w-4 h-4" />
            <span>{r.date}</span><span>{r.type}</span><span>{r.race}</span><span>{r.count}</span>
          </label>
        ))}
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onCancel} className="px-4 py-2 rounded border border-cyan-500 text-cyan-600 text-sm">キャンセル</button>
          <button onClick={() => onConfirm(results[selected])} className="px-4 py-2 rounded bg-cyan-500 text-white text-sm">確定</button>
        </div>
      </div>
    </div>
  );
}
