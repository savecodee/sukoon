import { useEffect, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Check,
  Download,
  Monitor,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Settings as SettingsIcon,
  SkipForward,
  Smartphone,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { unlockAudio } from "@/lib/chime";
import { phraseFor, treeProgress, weekMarks } from "@/lib/growth";
import { saveTreeCard } from "@/lib/tree-card";
import { useTimerEngine } from "@/lib/use-timer-engine";
import { FocusGarden } from "@/components/growth-tree";
import { openDeskWindow } from "@/components/desk-view";
import {
  usePomodoro,
  type Phase,
  type RunStatus,
  type Settings,
  type Task,
} from "@/lib/pomodoro-store";

const PRESETS: { id: string; label: string; hint: string; workMin: number; shortMin: number; longMin: number }[] = [
  { id: "classic", label: "كلاسيكي", hint: "25 / 5 / 15", workMin: 25, shortMin: 5, longMin: 15 },
  { id: "deep", label: "عمق", hint: "50 / 10 / 20", workMin: 50, shortMin: 10, longMin: 20 },
  { id: "brief", label: "قصير", hint: "15 / 3 / 10", workMin: 15, shortMin: 3, longMin: 10 },
];

type InstallChoice = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

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

function statusLabel(status: RunStatus) {
  if (status === "running") return "جارٍ";
  if (status === "paused") return "متوقف";
  return "جاهز";
}

function primaryLabel(phase: Phase, status: RunStatus) {
  if (status === "running") return "إيقاف مؤقت";
  if (status === "paused") return "استئناف";
  if (phase === "work") return "ابدأ التركيز";
  if (phase === "long") return "ابدأ الاستراحة الطويلة";
  return "ابدأ الاستراحة";
}

function toneOf(phase: Phase): "work" | "break" {
  return phase === "work" ? "work" : "break";
}

export function PomodoroApp() {
  const snapshot = usePomodoro();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [installEvent, setInstallEvent] = useState<InstallChoice | null>(null);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "windows" | "other" | null>(null);
  const [deskNote, setDeskNote] = useState<string | null>(null);

  useTimerEngine();

  useEffect(() => {
    const ua = navigator.userAgent;
    const touch = navigator.maxTouchPoints ?? 0;
    const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && touch > 1);
    if (ios) setPlatform("ios");
    else if (/Windows/i.test(ua)) setPlatform("windows");
    else setPlatform("other");

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setInstalled(standalone);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallChoice);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const tone = toneOf(snapshot.phase);
  const progress =
    snapshot.phaseTotalMs <= 0 ? 0 : 1 - snapshot.remainingMs / Math.max(snapshot.phaseTotalMs, 1);
  const activeTask = snapshot.tasks.find((task) => task.id === snapshot.activeTaskId) ?? null;
  const accentText = tone === "work" ? "text-work" : "text-break";
  const accentBg = tone === "work" ? "bg-work" : "bg-break";
  const barClass =
    snapshot.status === "idle"
      ? "bg-transparent"
      : snapshot.status === "paused"
        ? tone === "work"
          ? "bg-work/40"
          : "bg-break/40"
        : accentBg;

  const canReset = snapshot.status !== "idle" || snapshot.remainingMs !== snapshot.phaseTotalMs;
  const shownProject = snapshot.projects.find((project) => project.id === snapshot.activeProjectId) ?? null;
  const shown = {
    project: shownProject,
    minutes: shownProject ? shownProject.focusMinutes : snapshot.focusMinutes,
    score: shownProject ? shownProject.score : snapshot.score,
  };

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <div className={`h-1 ${barClass}`} aria-hidden="true" />
      <div className="app-shell mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs tracking-widest text-faint">مؤقت تركيز</p>
            <h1 className="text-2xl leading-none font-medium text-fg">سكون</h1>
          </div>
          <div className="flex items-center gap-2">
            <IconButton
              label={snapshot.settings.sound ? "كتم صوت الانتهاء" : "تشغيل صوت الانتهاء"}
              onClick={() => {
                unlockAudio();
                snapshot.toggleSound();
              }}
            >
              {snapshot.settings.sound ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
            </IconButton>
            <IconButton label="تثبيت التطبيق" onClick={() => setInstallOpen(true)}>
              <Download className="size-5" />
            </IconButton>
            <IconButton label="إعدادات المدد" onClick={() => setSettingsOpen(true)}>
              <SettingsIcon className="size-5" />
            </IconButton>
          </div>
        </header>

        <div className="grid min-w-0 grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="flex min-w-0 flex-col items-center gap-6 lg:pt-6" aria-label="المؤقت">
            <ProgressRing progress={progress} tone={tone}>
              <p className={`text-sm font-medium ${accentText}`}>{phaseLabel(snapshot.phase)}</p>
              <p
                className="font-display text-5xl leading-none font-medium tabular-nums tracking-tight text-fg sm:text-7xl"
                dir="ltr"
                role="timer"
                aria-label={`${phaseLabel(snapshot.phase)} ${formatTime(snapshot.remainingMs)} ${statusLabel(snapshot.status)}`}
              >
                {formatTime(snapshot.remainingMs)}
              </p>
              <p className="mt-2 flex items-center justify-center gap-2 text-sm text-muted">
                <span
                  className={`size-1.5 rounded-full ${snapshot.status === "running" ? `pulse-dot ${accentBg}` : "bg-faint"}`}
                  aria-hidden="true"
                />
                {statusLabel(snapshot.status)}
              </p>
            </ProgressRing>

            <ProjectBar />
            <label className="flex w-full max-w-sm flex-col gap-1">
              <span className="text-xs text-faint">هذه الجلسة من أجل</span>
              <input
                value={snapshot.intention}
                onChange={(event) => snapshot.setIntention(event.target.value)}
                maxLength={80}
                placeholder="سطر واحد، مثل مراجعة الفصل"
                className="field h-11 rounded-full bg-raised px-4 text-sm text-fg ring-1 ring-border placeholder:text-faint"
              />
            </label>
            <FocusGarden
              minutes={shown.minutes}
              score={shown.score}
              projectName={shown.project?.name ?? null}
              intention={snapshot.keptIntention}
              week={weekMarks(snapshot.weekLog)}
              phrase={phraseFor(
                shown.minutes,
                snapshot.status === "running" ? snapshot.phaseTotalMs - snapshot.remainingMs : 0,
                snapshot.customPhrases,
              )}
            />
            <button
              type="button"
              className="press h-11 px-3 text-sm text-muted hover:text-fg"
              onClick={() => {
                const progress = treeProgress(shown.minutes);
                void saveTreeCard({
                  score: shown.score,
                  stage: progress.name,
                  intention: snapshot.keptIntention || snapshot.intention,
                  project: shown.project?.name ?? null,
                });
              }}
            >
              احفظ بطاقة الشجرة
            </button>

            {snapshot.notice ? (
              <p className="max-w-sm text-center text-sm text-pretty text-muted" role="status">
                {snapshot.notice.text}
              </p>
            ) : (
              <a href="#tasks" className="max-w-xs truncate text-sm text-muted hover:text-fg">
                {activeTask ? `الآن: ${activeTask.title}` : "اختر مهمة لهذه الدورة"}
              </a>
            )}

            <div className="flex w-full max-w-sm flex-col items-center gap-3">
              <div className="flex w-full items-center gap-3">
                <button
                  type="button"
                  className={`press flex h-12 flex-1 items-center justify-center gap-2 rounded-full px-5 text-base font-medium ${
                    snapshot.status === "running" ? "bg-raised text-fg ring-1 ring-border" : `${accentBg} text-onaccent`
                  }`}
                  onClick={() => {
                    unlockAudio();
                    if (snapshot.status === "running") snapshot.pause();
                    else snapshot.start();
                  }}
                >
                  {snapshot.status === "running" ? (
                    <Pause className="size-5" />
                  ) : (
                    <Play className="size-5 -scale-x-100" />
                  )}
                  {primaryLabel(snapshot.phase, snapshot.status)}
                </button>
                <button
                  type="button"
                  className="press grid size-12 place-items-center rounded-full bg-raised text-fg ring-1 ring-border disabled:opacity-40"
                  aria-label="إعادة ضبط المرحلة"
                  disabled={!canReset}
                  onClick={() => snapshot.resetPhase()}
                >
                  <RotateCcw className="size-5" />
                </button>
              </div>
              <button
                type="button"
                className="press inline-flex h-11 items-center gap-2 px-3 text-sm text-muted hover:text-fg"
                onClick={() => snapshot.skip()}
              >
                <SkipForward className="size-4 -scale-x-100" />
                تخطّي هذه المرحلة
              </button>
            </div>

            <SessionMeter
              cycleSessions={snapshot.cycleSessions}
              cycleLength={snapshot.settings.cycleLength}
              todaySessions={snapshot.todaySessions}
              phase={snapshot.phase}
              onEdit={() => setSettingsOpen(true)}
              settings={snapshot.settings}
            />
            <div className="flex w-full max-w-sm flex-col items-center gap-2">
              <button
                type="button"
                className="press flex h-12 w-full items-center justify-center gap-2 rounded-full bg-raised px-4 text-sm font-medium text-fg ring-1 ring-border"
                onClick={() => {
                  void openDeskWindow().then((result) => {
                    if (result === "blocked") {
                      setDeskNote("المتصفح منع النافذة. اسمح بالنوافذ المنبثقة، أو افتح سكون في Chrome أو Edge على ويندوز.");
                      return;
                    }
                    setDeskNote(
                      result === "pip"
                        ? "النافذة العائمة مفتوحة. اسحبها لأي شاشة، وستبقى فوق البرامج."
                        : "فُتحت نافذة مستقلة. ضعها على الشاشة التي تريد واتركها مفتوحة.",
                    );
                  });
                }}
              >
                <Monitor className="size-5" />
                أبقِه ظاهراً على الشاشة
              </button>
              {deskNote ? <p className="text-center text-xs text-pretty text-faint">{deskNote}</p> : (
                <p className="text-center text-xs text-pretty text-faint">
                  على الحاسوب تُفتح نافذة يمكن سحبها لشاشة ثانية، والتقدم يبقى أمامك.
                </p>
              )}
              <button
                type="button"
                className="press flex h-12 w-full items-center justify-center gap-2 rounded-full bg-work px-4 text-sm font-medium text-onaccent"
                onClick={() => {
                  void (async () => {
                    try {
                      const res = await fetch("/sukoon.zip");
                      if (!res.ok) throw new Error("missing");
                      const blob = await res.blob();
                      const file = new File([blob], "sukoon.zip", { type: "application/zip" });
                      if (navigator.canShare?.({ files: [file] })) {
                        await navigator.share({ files: [file], title: "سكون" });
                        return;
                      }
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = "sukoon.zip";
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                      URL.revokeObjectURL(url);
                    } catch {
                      window.location.assign("/sukoon.zip");
                    }
                  })();
                }}
              >
                <Download className="size-5" />
                تحميل ملف التطبيق
              </button>
            </div>
            <p className="hidden text-xs text-faint lg:block">مسافة للبدء أو الإيقاف · R لإعادة الضبط</p>
          </section>

          <TaskPanel
            tasks={snapshot.tasks}
            activeTaskId={snapshot.activeTaskId}
            onAdd={snapshot.addTask}
            onToggle={snapshot.toggleTask}
            onRemove={snapshot.removeTask}
            onActivate={snapshot.setActiveTask}
            onNewCycle={snapshot.newCycle}
          />
        </div>
      </div>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={snapshot.settings}
        onChange={snapshot.updateSettings}
      />
      <InstallDialog
        open={installOpen}
        onOpenChange={setInstallOpen}
        installed={installed}
        platform={platform}
        canPrompt={installEvent != null}
        onPrompt={async () => {
          if (!installEvent) return;
          await installEvent.prompt();
          const choice = await installEvent.userChoice;
          if (choice.outcome === "accepted") setInstalled(true);
          setInstallEvent(null);
        }}
      />
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="press grid size-11 place-items-center rounded-full bg-raised text-fg ring-1 ring-border"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ProgressRing({
  progress,
  tone,
  children,
}: {
  progress: number;
  tone: "work" | "break";
  children: ReactNode;
}) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, progress));
  const offset = circumference * (1 - clamped);
  const stroke = tone === "work" ? "text-work" : "text-break";
  return (
    <div className="relative grid size-48 place-items-center sm:size-72">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="4.5" className="text-border" stroke="currentColor" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth="4.5"
          strokeLinecap="round"
          className={`${stroke} motion-safe:transition-[stroke-dashoffset] motion-safe:duration-200 motion-safe:ease-out`}
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">{children}</div>
    </div>
  );
}

function SessionMeter({
  cycleSessions,
  cycleLength,
  todaySessions,
  phase,
  settings,
  onEdit,
}: {
  cycleSessions: number;
  cycleLength: number;
  todaySessions: number;
  phase: Phase;
  settings: Settings;
  onEdit: () => void;
}) {
  const filled = Math.min(cycleSessions, cycleLength);
  const dot = phase === "long" ? "bg-break" : "bg-work";
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-3">
      <div className="flex items-center gap-2" aria-hidden="true">
        {Array.from({ length: cycleLength }, (_, index) => (
          <span key={index} className={`size-2.5 rounded-full ${index < filled ? dot : "bg-border"}`} />
        ))}
      </div>
      <p className="text-center text-sm text-muted">
        <span className="tabular-nums text-fg">{filled}</span>
        {` من ${cycleLength} في هذه الدورة`}
        <span className="px-2 text-faint">·</span>
        <span className="tabular-nums text-fg">{todaySessions}</span>
        {" اليوم"}
      </p>
      <button type="button" className="press text-sm text-faint hover:text-muted" onClick={onEdit}>
        {settings.workMin} تركيز · {settings.shortMin} استراحة · {settings.longMin} طويلة
      </button>
    </div>
  );
}

function TaskPanel({
  tasks,
  activeTaskId,
  onAdd,
  onToggle,
  onRemove,
  onActivate,
  onNewCycle,
}: {
  tasks: Task[];
  activeTaskId: string | null;
  onAdd: (title: string) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onActivate: (id: string) => void;
  onNewCycle: () => void;
}) {
  const [draft, setDraft] = useState("");
  const openCount = tasks.filter((task) => !task.done).length;
  return (
    <aside id="tasks" className="min-w-0 rounded-3xl bg-raised p-4 ring-1 ring-border sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">مهام هذه الدورة</h2>
          <p className="text-sm text-pretty text-faint">
            {openCount === 0 && tasks.length > 0
              ? "كل المهام منجزة. ستُصفّر بعد الاستراحة الطويلة."
              : "تُحسب جلسة التركيز على المهمة المحددة."}
          </p>
        </div>
        <button
          type="button"
          className="press h-11 shrink-0 rounded-full px-3 text-sm text-muted ring-1 ring-border hover:text-fg"
          onClick={onNewCycle}
        >
          دورة جديدة
        </button>
      </div>

      <form
        className="mb-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onAdd(draft);
          setDraft("");
        }}
      >
        <label className="sr-only" htmlFor="task-title">
          مهمة جديدة
        </label>
        <input
          id="task-title"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="أضف ما ستنجزه"
          maxLength={120}
          className="field h-12 min-w-0 flex-1 rounded-full bg-bg px-4 text-fg ring-1 ring-border placeholder:text-faint"
        />
        <button
          type="submit"
          className="press grid size-12 shrink-0 place-items-center rounded-full bg-fg text-bg disabled:opacity-40"
          aria-label="إضافة مهمة"
          disabled={draft.trim().length === 0}
        >
          <Plus className="size-5" />
        </button>
      </form>

      {tasks.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-pretty text-faint">
          لا مهام بعد. أضف مهمة واحدة لتبقى الدورة واضحة.
        </p>
      ) : (
        <ul className="flex max-h-[28rem] flex-col gap-2 overflow-auto">
          {tasks.map((task) => {
            const active = task.id === activeTaskId;
            return (
              <li
                key={task.id}
                className={`flex items-center gap-1 rounded-2xl pe-1 ${
                  active ? "bg-bg ring-1 ring-work" : "bg-bg/40"
                }`}
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={task.done}
                  aria-label={task.done ? `إلغاء إنجاز ${task.title}` : `تعليم ${task.title} كمنجزة`}
                  className="press grid size-11 shrink-0 place-items-center"
                  onClick={() => onToggle(task.id)}
                >
                  <span
                    className={`grid size-5 place-items-center rounded-md ring-1 ${
                      task.done ? "bg-work text-onaccent ring-work" : "ring-border"
                    }`}
                  >
                    {task.done ? <Check className="size-3.5" /> : null}
                  </span>
                </button>
                <button
                  type="button"
                  className="press flex min-w-0 flex-1 items-center gap-2 py-3 text-start"
                  onClick={() => onActivate(task.id)}
                  aria-pressed={active}
                >
                  <span className={`min-w-0 flex-1 truncate ${task.done ? "text-faint line-through" : "text-fg"}`}>
                    {task.title}
                  </span>
                  {active && !task.done ? <span className="text-xs text-work">الآن</span> : null}
                  {task.pomodoros > 0 ? (
                    <span className="tabular-nums text-xs text-muted" title="جلسات تركيز">
                      {task.pomodoros}
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  className="press grid size-11 shrink-0 place-items-center text-faint hover:text-fg"
                  aria-label={`حذف ${task.title}`}
                  onClick={() => onRemove(task.id)}
                >
                  <X className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

function ProjectBar() {
  const projects = usePomodoro((s) => s.projects);
  const activeId = usePomodoro((s) => s.activeProjectId);
  const addProject = usePomodoro((s) => s.addProject);
  const selectProject = usePomodoro((s) => s.selectProject);
  const removeProject = usePomodoro((s) => s.removeProject);
  const [name, setName] = useState("");

  return (
    <div className="flex w-full max-w-sm flex-col gap-2">
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          className={`press h-9 shrink-0 rounded-full px-3 text-sm ring-1 ${
            activeId == null ? "bg-bg text-fg ring-work" : "text-muted ring-border"
          }`}
          onClick={() => selectProject(null)}
        >
          الكل
        </button>
        {projects.map((project) => (
          <button
            key={project.id}
            type="button"
            className={`press h-9 max-w-40 shrink-0 truncate rounded-full px-3 text-sm ring-1 ${
              project.id === activeId ? "bg-bg text-fg ring-work" : "text-muted ring-border"
            }`}
            onClick={() => selectProject(project.id)}
          >
            {project.name}
          </button>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          addProject(name);
          setName("");
        }}
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={32}
          placeholder="مشروع، مثل المذاكرة"
          className="field h-11 min-w-0 flex-1 rounded-full bg-raised px-4 text-sm text-fg ring-1 ring-border placeholder:text-faint"
        />
        <button
          type="submit"
          className="press h-11 shrink-0 rounded-full px-4 text-sm text-fg ring-1 ring-border disabled:opacity-40"
          disabled={!name.trim() || projects.length >= 8}
        >
          أضف
        </button>
      </form>
      {activeId ? (
        <button type="button" className="self-start text-xs text-faint hover:text-fg" onClick={() => removeProject(activeId)}>
          احذف هذا المشروع
        </button>
      ) : (
        <p className="text-xs text-pretty text-faint">كل مشروع له شجرته. «الكل» يجمع تركيزك كله.</p>
      )}
    </div>
  );
}

function SettingsDialog({
  open,
  onOpenChange,
  settings,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: Settings;
  onChange: (partial: Partial<Settings>) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-bg/80" />
        <Dialog.Content className="sheet sheet-in fixed inset-x-0 bottom-0 z-50 overflow-y-auto rounded-t-3xl bg-raised p-5 ring-1 ring-border sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-lg font-medium">مدة الجلسات</Dialog.Title>
              <Dialog.Description className="text-sm text-pretty text-faint">
                التغيير يسري على المرحلة الحالية إن لم تكن قد بدأت، وعلى المراحل التالية إن كانت جارية.
              </Dialog.Description>
            </div>
            <Dialog.Close className="press grid size-11 place-items-center rounded-full ring-1 ring-border" aria-label="إغلاق">
              <X className="size-4" />
            </Dialog.Close>
          </div>

          <div className="mb-5 grid grid-cols-3 gap-2">
            {PRESETS.map((preset) => {
              const selected =
                settings.workMin === preset.workMin &&
                settings.shortMin === preset.shortMin &&
                settings.longMin === preset.longMin;
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={`press rounded-2xl px-2 py-3 text-center ring-1 ${
                    selected ? "bg-bg text-fg ring-work" : "text-muted ring-border"
                  }`}
                  onClick={() =>
                    onChange({ workMin: preset.workMin, shortMin: preset.shortMin, longMin: preset.longMin })
                  }
                >
                  <span className="block text-sm font-medium">{preset.label}</span>
                  <span className="mt-1 block text-xs tabular-nums text-faint" dir="ltr">
                    {preset.hint}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-3">
            <Stepper
              label="تركيز"
              value={settings.workMin}
              min={1}
              max={90}
              unit="د"
              onChange={(workMin) => onChange({ workMin })}
            />
            <Stepper
              label="استراحة قصيرة"
              value={settings.shortMin}
              min={1}
              max={45}
              unit="د"
              onChange={(shortMin) => onChange({ shortMin })}
            />
            <Stepper
              label="استراحة طويلة"
              value={settings.longMin}
              min={1}
              max={60}
              unit="د"
              onChange={(longMin) => onChange({ longMin })}
            />
            <Stepper
              label="جلسات قبل الاستراحة الطويلة"
              value={settings.cycleLength}
              min={2}
              max={8}
              unit=""
              onChange={(cycleLength) => onChange({ cycleLength })}
            />
          </div>
          <AmbienceField value={settings.ambience} onChange={(ambience) => onChange({ ambience })} />
          <PhraseField />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function AmbienceField({
  value,
  onChange,
}: {
  value: Settings["ambience"];
  onChange: (value: Settings["ambience"]) => void;
}) {
  const options: { id: Settings["ambience"]; label: string }[] = [
    { id: "off", label: "بدون" },
    { id: "rain", label: "مطر" },
    { id: "room", label: "غرفة" },
  ];
  return (
    <div className="mt-5">
      <p className="mb-2 text-sm">صوت المكان أثناء التركيز</p>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`press h-11 rounded-full text-sm ring-1 ${
              value === option.id ? "bg-bg text-fg ring-work" : "text-muted ring-border"
            }`}
            onClick={() => {
              unlockAudio();
              onChange(option.id);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-pretty text-faint">يتوقف في الاستراحة وفي الإيقاف. المطر والغرفة صوت هادئ، ليس موسيقى.</p>
    </div>
  );
}

function PhraseField() {
  const phrases = usePomodoro((s) => s.customPhrases);
  const addPhrase = usePomodoro((s) => s.addPhrase);
  const removePhrase = usePomodoro((s) => s.removePhrase);
  const [draft, setDraft] = useState("");
  return (
    <div className="mt-5">
      <p className="mb-2 text-sm">عباراتك</p>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          addPhrase(draft);
          setDraft("");
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={80}
          placeholder="جملة تظهر مع العبارات الجاهزة"
          className="field h-11 min-w-0 flex-1 rounded-full bg-bg px-4 text-sm text-fg ring-1 ring-border placeholder:text-faint"
        />
        <button type="submit" className="press h-11 shrink-0 rounded-full px-4 text-sm ring-1 ring-border" disabled={!draft.trim()}>
          أضف
        </button>
      </form>
      {phrases.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2">
          {phrases.map((line) => (
            <li key={line} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 text-pretty">{line}</span>
              <button type="button" className="shrink-0 text-xs text-faint hover:text-fg" onClick={() => removePhrase(line)}>
                حذف
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-faint">تظهر بالتناوب مع جمل سكون.</p>
      )}
    </div>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-bg px-3 py-2 ring-1 ring-border">
      <span className="text-sm">{label}</span>
      <div dir="ltr" className="flex items-center gap-1">
        <button
          type="button"
          className="press grid size-11 place-items-center rounded-full text-lg text-fg disabled:opacity-30"
          aria-label={`إنقاص ${label}`}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
        >
          −
        </button>
        <span className="w-14 text-center text-sm tabular-nums">
          {value}
          {unit ? <span className="text-faint">{unit}</span> : null}
        </span>
        <button
          type="button"
          className="press grid size-11 place-items-center rounded-full text-lg text-fg disabled:opacity-30"
          aria-label={`زيادة ${label}`}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
}

function InstallDialog({
  open,
  onOpenChange,
  installed,
  platform,
  canPrompt,
  onPrompt,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  installed: boolean;
  platform: "ios" | "windows" | "other" | null;
  canPrompt: boolean;
  onPrompt: () => Promise<void>;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-bg/80" />
        <Dialog.Content className="sheet sheet-in fixed inset-x-0 bottom-0 z-50 overflow-y-auto rounded-t-3xl bg-raised p-5 ring-1 ring-border sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-lg font-medium">تثبيت سكون</Dialog.Title>
              <Dialog.Description className="text-sm text-pretty text-faint">
                لا حاجة لمتجر. يُضاف من المتصفح كتطبيق مستقل على آيفون وويندوز، ويعمل دون اتصال بعد التثبيت.
              </Dialog.Description>
            </div>
            <Dialog.Close className="press grid size-11 place-items-center rounded-full ring-1 ring-border" aria-label="إغلاق">
              <X className="size-4" />
            </Dialog.Close>
          </div>

          {installed ? (
            <p className="mb-4 rounded-2xl bg-bg px-4 py-3 text-sm text-break ring-1 ring-border">
              التطبيق يعمل الآن بوضع مستقل على هذا الجهاز.
            </p>
          ) : null}

          {canPrompt ? (
            <button
              type="button"
              className="press mb-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-work text-onaccent font-medium"
              onClick={() => void onPrompt()}
            >
              <Download className="size-5" />
              تثبيت الآن
            </button>
          ) : null}

          <div className="flex flex-col gap-3">
            <InstallCard
              icon={<Smartphone className="size-5" />}
              title="آيفون"
              yours={platform === "ios"}
              steps={[
                "افتح الصفحة في Safari، لا داخل تطبيق آخر.",
                "اضغط زر المشاركة في أسفل الشاشة.",
                "اختر «إضافة إلى الشاشة الرئيسية» ثم «إضافة».",
              ]}
              action={
                <a
                  href="/?install=1&platform=ios"
                  className="press inline-flex h-11 items-center justify-center rounded-full px-4 text-sm text-fg ring-1 ring-border"
                >
                  دليل مصوّر لآيفون
                </a>
              }
            />
            <InstallCard
              icon={<Monitor className="size-5" />}
              title="ويندوز"
              yours={platform === "windows"}
              steps={[
                "افتح سكون في Microsoft Edge أو Chrome.",
                "من القائمة ⋯ اختر التطبيقات، ثم «تثبيت هذا الموقع كتطبيق».",
                "أو اضغط أيقونة التثبيت في شريط العنوان إن ظهرت.",
                "بعد التثبيت يمكن سحب نافذة سكون إلى أي شاشة. ومن الصفحة نفسها: «أبقِه ظاهراً على الشاشة» لتبقى الدرجة والشجرة أمامك.",
                "سيظهر سكون في قائمة ابدأ ويمكن تثبيته على سطح المكتب.",
              ]}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function InstallCard({
  icon,
  title,
  yours,
  steps,
  action,
}: {
  icon: ReactNode;
  title: string;
  yours: boolean;
  steps: string[];
  action?: ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-bg p-4 ring-1 ring-border">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-work">{icon}</span>
        <h3 className="font-medium">{title}</h3>
        {yours ? <span className="text-xs text-break">جهازك</span> : null}
      </div>
      <ol className="flex list-decimal flex-col gap-2 pe-1 ps-5 text-sm text-pretty text-muted">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {action ? <div className="mt-3">{action}</div> : null}
    </section>
  );
}
