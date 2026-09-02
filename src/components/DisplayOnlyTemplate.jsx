import { useCameras } from "../hooks/useCameras";
import { useSharedConfig } from "../hooks/useSharedConfig";
import { MultiCameraTemplateView } from "./MultiCameraTemplateView";

// Chrome-less display-only mode — opened via "?display=template", skips
// login entirely, just shows the 4-monitor template full page. Reads which
// monitor it represents from "?monitor=N" in the URL.
export function DisplayOnlyTemplate() {
  const camState = useCameras();
  const { config } = useSharedConfig();
  const monitorNum = Number(new URLSearchParams(window.location.search).get("monitor")) || 1;
  return (
    <div className="min-h-screen bg-zinc-950 p-2">
      <MultiCameraTemplateView cameras={camState.cameras} lockedTemplate={config.monitorTemplates[monitorNum]} sharedDelaySeconds={config.delaySeconds} monitorNum={monitorNum} slotCameraNames={config.monitorCameraAssignments?.[monitorNum]} />
    </div>
  );
}
