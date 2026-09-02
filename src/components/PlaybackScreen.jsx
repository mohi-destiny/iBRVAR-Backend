import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward, Repeat, ExternalLink, Search } from "lucide-react";
import { VideoTile } from "./shared/VideoTile";
import { SearchResultsModal } from "./shared/SearchResultsModal";
import { CAMERA_SERVER, DEFAULT_DELAY_S, TIMELINE_MARKERS, HIGHLIGHT_MARKERS } from "../constants";

// Screen 2 — Playback (再生アプリによるレース映像の再生). Referee 2's screen.
export function PlaybackScreen({ liveCam, delaySeconds = DEFAULT_DELAY_S }) {
  const videoRef = useRef(null);
  const [date, setDate] = useState("");
  const [type, setType] = useState("展示");
  const [raceNumber, setRaceNumber] = useState("1R");
  const [count, setCount] = useState("01");
  const [results, setResults] = useState(null);
  const [loaded, setLoaded] = useState(null); // the recording currently in the player
  const [lineMarker, setLineMarker] = useState(false);
  const [repeatSeconds, setRepeatSeconds] = useState(7);
  const [speed, setSpeed] = useState(1.0);
  const [repeatOn, setRepeatOn] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [markerIndex, setMarkerIndex] = useState(0);
  const [searchError, setSearchError] = useState(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.playbackRate = speed;
  }, [speed, loaded]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !repeatOn) return;
    const onTimeUpdate = () => {
      if (video.currentTime >= video.duration - 0.15) video.currentTime = Math.max(0, video.duration - repeatSeconds);
    };
    video.addEventListener("timeupdate", onTimeUpdate);
    return () => video.removeEventListener("timeupdate", onTimeUpdate);
  }, [repeatOn, repeatSeconds]);

  const search = useCallback(async () => {
    setSearchError(null);
    const params = new URLSearchParams();
    if (date) params.set("date", date);
    if (type) params.set("type", type);
    if (raceNumber) params.set("race", raceNumber);
    if (count) params.set("count", count);
    if (liveCam?.name) params.set("camera", liveCam.name); // only this screen's own camera — no cross-camera duplicates
    try {
      const res = await fetch(`${CAMERA_SERVER}/api/recordings?${params.toString()}`);
      const data = await res.json();
      const found = data.results || [];
      if (found.length === 0) { setSearchError("no matching recording found"); return; }
      // exact match on every field the search form can specify → skip the
      // popup and load it directly; otherwise let the operator pick
      if (date && type && raceNumber && count && found.length === 1) {
        setLoaded(found[0]);
      } else {
        setResults(found);
      }
    } catch {
      setSearchError("couldn't reach the server");
    }
  }, [date, type, raceNumber, count, liveCam]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) { video.play(); setIsPlaying(true); } else { video.pause(); setIsPlaying(false); }
  };

  // Keyboard controls for the loaded recording: Space = play/pause,
  // ArrowLeft/Right = seek 5s back/forward, S = stop.
  useEffect(() => {
    if (!loaded) return;
    const onKeyDown = (e) => {
      if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
      const video = videoRef.current;
      if (!video) return;
      if (e.key === " ") { e.preventDefault(); togglePlay(); }
      else if (e.key === "ArrowLeft") { video.currentTime = Math.max(0, video.currentTime - 5); }
      else if (e.key === "ArrowRight") { video.currentTime = Math.min(video.duration || 0, video.currentTime + 5); }
      else if (e.key.toLowerCase() === "s") { video.pause(); video.currentTime = 0; setIsPlaying(false); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  return (
    <div className="bg-zinc-950 text-zinc-100 p-4 rounded-lg border border-zinc-800">
      <h2 className="text-sm font-semibold mb-3">Playback — 再生アプリによるレース映像の再生</h2>

      {!loaded && liveCam && (
        <div className="mb-4">
          <VideoTile cam={liveCam} label="LIVE" />
        </div>
      )}

      {(loaded || !liveCam) && (
      <div className="relative bg-black rounded overflow-hidden aspect-video mb-3">
        {loaded ? (
          <video
            ref={videoRef}
            src={`${CAMERA_SERVER}${loaded.url}`}
            className="w-full h-full object-contain"
            controls={false}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">no recording loaded — search below</div>
        )}
        {lineMarker && loaded && <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-cyan-400/60 pointer-events-none" />}
        {loaded && (
          <div className="absolute top-2 left-2 flex items-center gap-2">
            <span className="px-2 py-1 rounded bg-black/60 text-[11px] font-mono text-zinc-200">
              {loaded.date} · {loaded.type} · {loaded.race} · #{loaded.count}
            </span>
            <button onClick={() => { setLoaded(null); setIsPlaying(false); }} className="px-2 py-1 rounded bg-cyan-500 text-zinc-950 text-[11px] font-semibold">
              ← Back to Live
            </button>
          </div>
        )}
      </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-xs text-zinc-500 mb-1.5">検索条件</p>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="text-[11px] text-zinc-500 block">日付</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs font-mono" />
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 block">種別</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs">
                <option>展示</option><option>本番</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 block">レース番号</label>
              <select value={raceNumber} onChange={(e) => setRaceNumber(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs">
                {Array.from({ length: 12 }, (_, i) => `${i + 1}R`).map((n) => <option key={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 block">回数</label>
              <select value={count} onChange={(e) => setCount(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs">
                {["01", "02", "03"].map((n) => <option key={n}>{n}</option>)}
              </select>
            </div>
            <button onClick={search} className="flex items-center gap-1.5 bg-cyan-500 text-zinc-950 text-xs font-medium px-3 py-1.5 rounded">
              <Search className="w-3.5 h-3.5" /> 検索
            </button>
          </div>
          {searchError && <p className="text-xs text-red-400 mt-1.5">{searchError}</p>}
          <p className="text-[11px] text-zinc-600 mt-1.5">Leave 日付 blank to see every matching race across all dates.</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs space-y-2">
          <div className="flex items-center justify-between gap-4">
            <span className="text-zinc-400">ラインマーカ</span>
            <button onClick={() => setLineMarker((v) => !v)} className={`w-9 h-5 rounded-full relative transition ${lineMarker ? "bg-cyan-500" : "bg-zinc-700"}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition ${lineMarker ? "left-4" : "left-0.5"}`} />
            </button>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-zinc-400">リピート再生</span>
            <input type="number" value={repeatSeconds} onChange={(e) => setRepeatSeconds(Number(e.target.value) || 7)} className="w-14 bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 font-mono" />
            <span className="text-zinc-500">秒</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-zinc-400">再生速度</span>
            {[0.5, 1.0, 2.0].map((s) => (
              <label key={s} className="flex items-center gap-1 cursor-pointer">
                <input type="radio" checked={speed === s} onChange={() => setSpeed(s)} /> {s}x
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="relative mb-4 px-2">
        <div className="h-0.5 bg-zinc-700 relative">
          {TIMELINE_MARKERS.map((m, i) => (
            <button
              key={m}
              onClick={() => {
                setMarkerIndex(i);
                const video = videoRef.current;
                if (video?.duration) video.currentTime = (i / (TIMELINE_MARKERS.length - 1)) * video.duration;
              }}
              className="absolute -top-1.5 flex flex-col items-center"
              style={{ left: `${(i / (TIMELINE_MARKERS.length - 1)) * 100}%`, transform: "translateX(-50%)" }}
              title="Marker position is proportional until real per-marker timestamps are available"
            >
              <span className={`w-3 h-3 rounded-full border-2 border-zinc-950 ${i === markerIndex ? "bg-cyan-400" : "bg-blue-500"}`} />
              <span className={`text-[10px] mt-3 whitespace-nowrap ${HIGHLIGHT_MARKERS.has(m) ? "text-red-400" : "text-zinc-400"}`}>{m}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-zinc-600 -mt-2 mb-4">
        Timeline markers are placed proportionally along the clip for now — wire them to real race-event timestamps once that data source exists.
      </p>

      <div className="flex items-center justify-between mt-8">
        <div className="flex items-center gap-3">
          <button onClick={() => setMarkerIndex((i) => Math.max(0, i - 1))} className="p-2 rounded bg-zinc-800 hover:bg-zinc-700"><SkipBack className="w-4 h-4" /></button>
          <button onClick={togglePlay} className="p-2 rounded bg-cyan-500 text-zinc-950">{isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}</button>
          <button onClick={() => setMarkerIndex((i) => Math.min(TIMELINE_MARKERS.length - 1, i + 1))} className="p-2 rounded bg-zinc-800 hover:bg-zinc-700"><SkipForward className="w-4 h-4" /></button>
          <button onClick={() => setRepeatOn((v) => !v)} className={`p-2 rounded ${repeatOn ? "bg-violet-500 text-zinc-950" : "bg-zinc-800 text-zinc-300"}`} title="リピート再生">
            <Repeat className="w-4 h-4" />
          </button>
        </div>
        <button className="flex items-center gap-1.5 text-xs px-3 py-2 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700">
          <ExternalLink className="w-3.5 h-3.5" /> 外部出力
        </button>
      </div>

      {results && (
        <SearchResultsModal
          results={results}
          onCancel={() => setResults(null)}
          onConfirm={(r) => { setLoaded(r); setResults(null); }}
        />
      )}
    </div>
  );
}