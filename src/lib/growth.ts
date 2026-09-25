export const PHRASES = [
  "خطوة واحدة هادئة تكفي الآن.",
  "كل دقيقة تركيز ورقة جديدة على شجرتك.",
  "لا تستعجل الثمر. اسقِ العمل.",
  "أنت هنا، وهذا بداية كافية.",
  "الانتباه يعود كلما عدت إليه.",
  "شجرتك تكبر بما تُنجزه، لا بما تؤجله.",
  "استراحة قصيرة تحفظ ما بنيته.",
  "اليوم يُصنع من جلسات صغيرة.",
  "ابقَ على هذا السطر فقط.",
  "النمو البطيء أصلب.",
  "درجة جديدة تعني جذراً أعمق.",
  "اترك الضجيج خارج هذه الدقائق.",
] as const;

export const TREE_STAGES = [
  { min: 0, name: "بذرة" },
  { min: 25, name: "برعم" },
  { min: 75, name: "شتلة" },
  { min: 150, name: "شجيرة" },
  { min: 300, name: "شجرة" },
  { min: 600, name: "وارفة" },
  { min: 1200, name: "عتيقة" },
] as const;

export function phraseFor(focusMinutes: number, elapsedMs: number, custom: readonly string[] = []) {
  const pool = [...PHRASES, ...custom.map((line) => line.trim()).filter(Boolean)];
  const step = Math.floor(Math.max(0, elapsedMs) / 40_000);
  const index = Math.abs(Math.floor(focusMinutes) + step) % pool.length;
  return pool[index] ?? PHRASES[0];
}

export function treeProgress(minutes: number) {
  const safe = Math.max(0, Math.floor(minutes));
  let index = 0;
  for (let i = 0; i < TREE_STAGES.length; i += 1) {
    if (safe >= TREE_STAGES[i].min) index = i;
  }
  const current = TREE_STAGES[index];
  const next = TREE_STAGES[index + 1];
  const span = next ? next.min - current.min : 1;
  const ratio = next ? Math.min(1, (safe - current.min) / span) : 1;
  return {
    index,
    name: current.name,
    nextName: next?.name ?? null,
    remain: next ? next.min - safe : 0,
    ratio,
  };
}

const WEEK_LABELS = ["س", "ح", "ن", "ث", "ر", "خ", "ج"] as const;

function dayKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type WeekMark = {
  key: string;
  label: string;
  minutes: number;
  today: boolean;
  future: boolean;
};

export function weekMarks(log: Record<string, number> | undefined, now = new Date()): WeekMark[] {
  const sinceSaturday = (now.getDay() + 1) % 7;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - sinceSaturday);
  const today = dayKey(now);
  return WEEK_LABELS.map((label, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = dayKey(date);
    return {
      key,
      label,
      minutes: Math.max(0, Math.floor(log?.[key] ?? 0)),
      today: key === today,
      future: key > today,
    };
  });
}
