import { useState, useCallback } from "react";
import { Video, Layers, Clapperboard, PlaySquare } from "lucide-react";
import { useCameras } from "./hooks/useCameras";
import { accentFor } from "./constants";
import { LiveCamerasTab } from "./components/live/LiveCamerasTab";
import { MultiCameraTemplateView } from "./components/MultiCameraTemplateView";
import { RaceRecordingScreen } from "./components/RaceRecordingScreen";
import { PlaybackScreen } from "./components/PlaybackScreen";
import { DEFAULT_DELAY_S } from "./constants";

// Simple tab shell (no login) — handy for testing individual screens
// directly. Production entry point is AdminApp.jsx (login + role routing).
const TABS = [
  { key: "live", label: "Live Cameras", icon: Video },
  { key: "template", label: "Template View", icon: Layers },
  { key: "recording", label: "Screen 1 · Recording", icon: Clapperboard },
  { key: "playback", label: "Screen 2 · Playback", icon: PlaySquare },
];

export default function App() {
  const [tab, setTab] = useState("live");
  const camState = useCameras();
  const [openDelayId, setOpenDelayId] = useState(null);
  const [delaySeconds, setDelaySeconds] = useState(DEFAULT_DELAY_S);
  const [cpuLog, setCpuLog] = useState([]);
  const [showInfo, setShowInfo] = useState(false);

  const handleCpuLog = useCallback((cam, label, ms) => {
    setCpuLog((prev) => [
      ...prev,
      { key: `${cam.id}-${Date.now()}-${Math.random()}`, time: new Date().toLocaleTimeString(), name: cam.name, accent: accentFor(cam.id).solid, label, ms },
    ]);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <div className="max-w-6xl mx-auto px-4 pt-4 flex flex-wrap gap-1.5">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition ${tab === key ? "bg-cyan-500 text-zinc-950 border-cyan-500" : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700"}`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === "live" && (
        <LiveCamerasTab
          {...camState}
          delaySeconds={delaySeconds} setDelaySeconds={setDelaySeconds}
          cpuLog={cpuLog} handleCpuLog={handleCpuLog}
          showInfo={showInfo} setShowInfo={setShowInfo}
          openDelayId={openDelayId} setOpenDelayId={setOpenDelayId}
        />
      )}
      {tab === "template" && (
        <div className="max-w-6xl mx-auto px-4 py-6">
          <MultiCameraTemplateView cameras={camState.cameras} />
        </div>
      )}
      {tab === "recording" && (
        <div className="max-w-6xl mx-auto px-4 py-6">
          <RaceRecordingScreen cameras={camState.cameras} />
        </div>
      )}
      {tab === "playback" && (
        <div className="max-w-6xl mx-auto px-4 py-6">
          <PlaybackScreen liveCam={camState.cameras[0]} />
        </div>
      )}
    </div>
  );
}