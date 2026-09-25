import { useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Pause, Play } from "lucide-react";
import { unlockAudio } from "@/lib/chime";
import { phraseFor, weekMarks } from "@/lib/growth";
import { usePomodoro, type Phase, type RunStatus } from "@/lib/pomodoro-store";
import { useTimerEngine } from "@/lib/use-timer-engine";
import { FocusGarden } from "@/components/growth-tree";

type PipApi = {
  requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
  window: Window | null;
};

function pipApi(): PipApi | null {
  if (typeof window === "undefined") return null;
  const api = (window as Window & { documentPictureInPicture?: PipApi }).documentPictureInPicture;
  return api ?? null;
}

export function canPinWindow() {
  return pipApi() != null;
}

function formatTime(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function phaseLabel(phase: Phase) {
  if (phase === "work") return "تركيز";
  if (phase === "long") return "استراحة طويلة";
  return "استراحة";
}

function primaryLabel(phase: Phase, status: RunStatus) {
  if (status === "running") return "إيقاف مؤقت";
  if (status === "paused") return "استئناف";
  if (phase === "work") return "ابدأ التركيز";
  if (phase === "long") return "ابدأ الاستراحة الطويلة";
  return "ابدأ الاستراحة";
}

function copyStyles(target: Document) {
  const fallback = target.createElement("style");
  fallback.textContent =
    ":root{color-scheme:dark}body{margin:0;background:#141210;color:#f6f1ea;font-family:'Segoe UI',Tahoma,sans-serif}";
  target.head.appendChild(fallback);
  for (const sheet of document.styleSheets) {
    try {
      const css = [...sheet.cssRules].map((rule) => rule.cssText).join("\n");
      const style = target.createElement("style");
      style.textContent = css;
      target.head.appendChild(style);
    } catch {
      if (sheet.href) {
        const link = target.createElement("link");
        link.rel = "stylesheet";
        link.href = sheet.href;
        target.head.appendChild(link);
      }
    }
  }
}

let pipRoot: Root | null = null;

function mountPip(win: Window) {
  const doc = win.document;
  doc.documentElement.lang = "ar";
  doc.documentElement.dir = "rtl";
  doc.title = "سكون";
  copyStyles(doc);
  doc.body.replaceChildren();
  const mount = doc.createElement("div");
  doc.body.appendChild(mount);
  pipRoot?.unmount();
  pipRoot = createRoot(mount);
  pipRoot.render(<GardenFace pinned />);
  const close = () => {
    pipRoot?.unmount();
    pipRoot = null;
  };
  win.addEventListener("pagehide", close, { once: true });
}

export async function openDeskWindow(): Promise<"pip" | "popup" | "blocked"> {
  const api = pipApi();
  if (api?.window) {
    api.window.focus();
    return "pip";
  }
  if (api) {
    try {
      const win = await api.requestWindow({ width: 380, height: 680 });
      mountPip(win);
      return "pip";
    } catch {
      // Popup fallback below.
    }
  }
  const popup = window.open("/?view=desk", "sukoon-desk", "popup=yes,width=400,height=720,left=72,top=48");
  if (!popup) return "blocked";
  popup.focus();
  return "popup";
}

export function GardenFace({ pinned = false }: { pinned?: boolean }) {
  const snapshot = usePomodoro();
  const project = snapshot.projects.find((item) => item.id === snapshot.activeProjectId) ?? null;
  const minutes = project ? project.focusMinutes : snapshot.focusMinutes;
  const score = project ? project.score : snapshot.score;
  const elapsed = snapshot.status === "running" ? snapshot.phaseTotalMs - snapshot.remainingMs : 0;
  const phrase = phraseFor(minutes, elapsed, snapshot.customPhrases);
  const tone = snapshot.phase === "work" ? "work" : "break";
  const accentBg = tone === "work" ? "bg-work" : "bg-break";

  return (
    <div className="flex min-h-dvh flex-col items-center gap-5 bg-bg px-5 py-6 text-fg">
      <div className="text-center">
        <p className="text-xs tracking-widest text-faint">سكون</p>
        <p className={`mt-1 text-sm ${tone === "work" ? "text-work" : "text-break"}`}>{phaseLabel(snapshot.phase)}</p>
        <p className="font-display text-6xl leading-none font-medium tabular-nums" dir="ltr" role="timer">
          {formatTime(snapshot.remainingMs)}
        </p>
      </div>
      <FocusGarden
        minutes={minutes}
        score={score}
        phrase={phrase}
        projectName={project?.name ?? null}
        intention={snapshot.keptIntention}
        week={weekMarks(snapshot.weekLog)}
      />
      <button
        type="button"
        className={`press flex h-12 w-full max-w-sm items-center justify-center gap-2 rounded-full px-5 font-medium ${
          snapshot.status === "running" ? "bg-raised text-fg ring-1 ring-border" : `${accentBg} text-onaccent`
        }`}
        onClick={() => {
          unlockAudio();
          if (snapshot.status === "running") snapshot.pause();
          else snapshot.start();
        }}
      >
        {snapshot.status === "running" ? <Pause className="size-5" /> : <Play className="size-5 -scale-x-100" />}
        {primaryLabel(snapshot.phase, snapshot.status)}
      </button>
      <p className="max-w-sm text-center text-xs text-pretty text-faint">
        {pinned
          ? "هذه النافذة تبقى فوق البرامج. اسحبها إلى أي شاشة، والتقدم يبقى ظاهراً دون أن تفتح الصفحة من جديد."
          : "اترك هذه النافذة على الشاشة التي تريد. التقدم والدرجة والشجرة تتحدث حتى لو أغلقت الصفحة الكبيرة."}
      </p>
    </div>
  );
}

export function DeskView() {
  useTimerEngine();
  return <GardenFace />;
}

export function useDeskAvailability() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready && (canPinWindow() || typeof window.open === "function");
}
