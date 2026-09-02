import { useState } from "react";
import {
  LogOut, Settings, Video, PlaySquare, Users, MapPin, Clock,
  Crosshair, Ruler, Monitor, ChevronDown, ChevronRight, ShieldCheck,
} from "lucide-react";
import { useCameras } from "../../hooks/useCameras";
import { useSharedConfig } from "../../hooks/useSharedConfig";
import { LiveCamerasTab } from "../live/LiveCamerasTab";
import { UserManagementScreen } from "./UserManagementScreen";
import { VariousSettingsScreen } from "./VariousSettingsScreen";
import { FrameCalibrationScreen } from "./FrameCalibrationScreen";
import { LineBasedPlaceholder } from "./LineBasedPlaceholder";
import { MonitorAssignmentScreen } from "./MonitorAssignmentScreen";
import { RaceRecordingScreen } from "../RaceRecordingScreen";
import { PlaybackScreen } from "../PlaybackScreen";
import { DEFAULT_ACCESS } from "../../constants";

const SETTINGS_SUBMENU = [
  { key: "users", label: "ユーザ管理", icon: Users },
  { key: "various", label: "各種設定", icon: Settings },
  { key: "pit", label: "ピット位置定義", icon: MapPin },
  { key: "t60", label: "待機(T-60)位置定義", icon: Clock },
  { key: "t12", label: "T-12位置定義", icon: Crosshair },
  { key: "eventline", label: "イベントラインクロス位置定義", icon: Ruler },
  { key: "linemarker", label: "ラインマーカ定義", icon: Ruler },
  { key: "monitor", label: "モニタ構成定義", icon: Monitor },
];

// Admin — full sidebar per the PDF's 4 top-level modules (ログイン handled
// by AdminApp itself, 設定/録画/再生 below).
export function AdminView({ user, onLogout }) {
  const camState = useCameras();
  const { config, updateConfig } = useSharedConfig();
  const [section, setSection] = useState("live");
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [access, setAccess] = useState(DEFAULT_ACCESS);

  const renderMain = () => {
    switch (section) {
      case "live": return <LiveCamerasTab {...camState} delaySeconds={config.delaySeconds} setDelaySeconds={(v) => updateConfig({ delaySeconds: v })} cpuLog={[]} handleCpuLog={() => {}} showInfo={false} setShowInfo={() => {}} openDelayId={null} setOpenDelayId={() => {}} />;
      case "users": return <UserManagementScreen access={access} setAccess={setAccess} />;
      case "various": return <VariousSettingsScreen config={config} updateConfig={updateConfig} />;
      case "pit": return <FrameCalibrationScreen title="ピット位置定義 (Pit Position Definition)" cameras={camState.cameras} />;
      case "t60": return <FrameCalibrationScreen title="待機(T-60)位置定義 (Standby T-60 Position)" cameras={camState.cameras} />;
      case "t12": return <FrameCalibrationScreen title="T-12位置定義 (T-12 AI Fleet Tracking)" cameras={camState.cameras} />;
      case "eventline": return <LineBasedPlaceholder title="イベントラインクロス位置定義 (Event Line Cross)" cameras={camState.cameras} />;
      case "linemarker": return <LineBasedPlaceholder title="ラインマーカ定義 (Line Marker Definition)" cameras={camState.cameras} />;
      case "monitor": return <MonitorAssignmentScreen config={config} updateConfig={updateConfig} cameras={camState.cameras} />;
      case "recording": return <RaceRecordingScreen cameras={camState.cameras} maxRaces={config.maxRaces} venue={config.venue} delaySeconds={config.delaySeconds} />;
      case "playback": return <PlaybackScreen liveCam={camState.cameras[0]} delaySeconds={config.delaySeconds} />;
      default: return null;
    }
  };

  const NavItem = ({ k, label, Icon, indent }) => (
    <button
      onClick={() => setSection(k)}
      className={`w-full flex items-center gap-2 text-xs px-3 py-2 rounded transition text-left ${section === k ? "bg-cyan-500 text-zinc-950 font-medium" : "text-zinc-400 hover:bg-zinc-800"} ${indent ? "ml-4" : ""}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex">
      <aside className="w-64 border-r border-zinc-800 p-3 flex flex-col gap-1 shrink-0">
        <div className="flex items-center gap-2 px-2 py-2 mb-2">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold">iBRVAR Admin</span>
        </div>
        <NavItem k="live" label="Live Cameras" Icon={Video} />
        <button onClick={() => setSettingsOpen((v) => !v)} className="w-full flex items-center gap-2 text-xs px-3 py-2 rounded text-zinc-300 hover:bg-zinc-800">
          {settingsOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          <Settings className="w-3.5 h-3.5" /> 設定 (Settings)
        </button>
        {settingsOpen && SETTINGS_SUBMENU.map(({ key, label, icon }) => <NavItem key={key} k={key} label={label} Icon={icon} indent />)}
        <NavItem k="recording" label="録画 (Recording)" Icon={Video} />
        <NavItem k="playback" label="再生 (Playback)" Icon={PlaySquare} />
        <div className="flex-1" />
        <div className="text-[11px] text-zinc-600 px-2 mb-1">{user.label}</div>
        <button onClick={onLogout} className="w-full flex items-center gap-2 text-xs px-3 py-2 rounded text-zinc-400 hover:bg-zinc-800">
          <LogOut className="w-3.5 h-3.5" /> Logout
        </button>
      </aside>
      <main className="flex-1 p-4 overflow-auto">{renderMain()}</main>
    </div>
  );
}