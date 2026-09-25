import { treeProgress, type WeekMark } from "@/lib/growth";

const LEAF = "M0 0C8-20 22-22 26-4C18 16 6 13 0 0Z";

function Leaf({
  x,
  y,
  rotate,
  scale = 1,
  tone = "mid",
}: {
  x: number;
  y: number;
  rotate: number;
  scale?: number;
  tone?: "deep" | "mid" | "lit";
}) {
  const fill =
    tone === "deep" ? "var(--color-leaf-deep)" : tone === "lit" ? "var(--color-leaf-lit)" : "var(--color-leaf)";
  return <path d={LEAF} fill={fill} transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`} />;
}

function Ground({ blades }: { blades: number }) {
  return (
    <g>
      <ellipse cx="110" cy="158" rx="70" ry="28" fill="var(--color-break)" opacity="0.07" />
      <path d="M24 208c24-30 56-42 86-42s62 12 86 42c-26 18-58 26-86 26s-60-8-86-26z" fill="var(--color-soil)" />
      <path d="M52 206c18-16 40-24 58-22 16 2 34 10 48 20-22 8-46 10-70 6-14-2-26-2-36-4z" fill="var(--color-soil-lit)" opacity="0.45" />
      {Array.from({ length: blades }, (_, i) => {
        const x = 42 + (i * 136) / Math.max(blades - 1, 1);
        const h = 10 + (i % 3) * 5;
        return (
          <path
            key={i}
            d={`M${x} 206c1-${h} 7-${h} 5-${h + 10}`}
            stroke="var(--color-leaf)"
            strokeWidth="1.7"
            fill="none"
            strokeLinecap="round"
          />
        );
      })}
    </g>
  );
}

function Trunk({ top, base, thick }: { top: number; base: number; thick: number }) {
  const left = 110 - thick;
  const right = 110 + thick;
  const neck = Math.max(4, thick * 0.42);
  return (
    <g>
      <path
        d={`M${left} ${base}
            C${left - 2} ${(base + top) / 2} ${110 - neck - 2} ${top + 16} ${110 - neck} ${top}
            L${110 + neck} ${top}
            C${110 + neck + 2} ${top + 16} ${right + 2} ${(base + top) / 2} ${right} ${base}Z`}
        fill="var(--color-bark)"
      />
      <path
        d={`M${110 - 1} ${base - 6}C${108} ${(base + top) / 2} ${109} ${top + 18} ${111} ${top + 6}`}
        stroke="var(--color-bark-lit)"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
        opacity="0.85"
      />
    </g>
  );
}

function Crown({
  cx,
  cy,
  rx,
  ry,
  leaves,
}: {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  leaves: { x: number; y: number; r: number; s: number; tone?: "deep" | "mid" | "lit" }[];
}) {
  return (
    <g>
      <ellipse cx={cx - rx * 0.46} cy={cy + ry * 0.18} rx={rx * 0.58} ry={ry * 0.78} fill="var(--color-leaf-deep)" />
      <ellipse cx={cx + rx * 0.46} cy={cy + ry * 0.16} rx={rx * 0.58} ry={ry * 0.76} fill="var(--color-leaf-deep)" />
      <ellipse cx={cx} cy={cy + ry * 0.28} rx={rx * 0.5} ry={ry * 0.55} fill="var(--color-leaf-deep)" />
      <ellipse cx={cx} cy={cy - ry * 0.08} rx={rx * 0.62} ry={ry * 0.7} fill="var(--color-leaf-mid)" />
      <ellipse cx={cx - rx * 0.16} cy={cy - ry * 0.36} rx={rx * 0.3} ry={ry * 0.28} fill="var(--color-leaf-lit)" opacity="0.88" />
      {leaves.map((leaf) => (
        <Leaf key={`${leaf.x}-${leaf.y}`} x={leaf.x} y={leaf.y} rotate={leaf.r} scale={leaf.s} tone={leaf.tone} />
      ))}
    </g>
  );
}

function Fruits({ points }: { points: [number, number][] }) {
  return (
    <g>
      {points.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r="5" fill="var(--color-work)" />
          <circle cx={x - 1.4} cy={y - 1.5} r="1.5" fill="var(--color-leaf-lit)" opacity="0.75" />
        </g>
      ))}
    </g>
  );
}

function Motes({ points }: { points: [number, number][] }) {
  return (
    <g>
      {points.map(([x, y], i) => (
        <circle
          key={`${x}-${y}`}
          cx={x}
          cy={y}
          r={i % 2 === 0 ? 2.2 : 1.5}
          fill="var(--color-leaf-lit)"
          className="tree-mote"
          style={{ animationDelay: `${i * 0.65}s` }}
        />
      ))}
    </g>
  );
}

function Living({ index, ratio }: { index: number; ratio: number }) {
  const shoot = 14 + ratio * 26;

  if (index === 0) {
    return (
      <g>
        <ellipse cx="110" cy="196" rx="16" ry="7" fill="var(--color-soil-lit)" />
        <g transform="translate(110 188) rotate(-18)">
          <ellipse cx="0" cy="0" rx="13" ry="8" fill="var(--color-work)" />
          <ellipse cx="-3" cy="-2" rx="4" ry="2" fill="var(--color-leaf-lit)" opacity="0.4" />
          <path d="M-8 1c3-3 10-3 16 1" stroke="var(--color-bark)" strokeWidth="1" fill="none" />
        </g>
        {ratio > 0.05 ? (
          <path
            d={`M110 190c-1-${shoot * 0.4} 2-${shoot} 8-${shoot + 6}`}
            stroke="var(--color-leaf-mid)"
            strokeWidth="2.6"
            fill="none"
            strokeLinecap="round"
          />
        ) : null}
        {ratio > 0.4 ? <Leaf x={118} y={188 - shoot} rotate={-16} scale={0.48 + ratio * 0.22} tone="lit" /> : null}
      </g>
    );
  }

  if (index === 1) {
    return (
      <g className="tree-sway">
        <path
          d="M110 206c-4-34 2-62 10-92"
          stroke="var(--color-leaf-deep)"
          strokeWidth="3.4"
          fill="none"
          strokeLinecap="round"
        />
        <Leaf x={92} y={164} rotate={-58} scale={0.85} />
        <Leaf x={128} y={142} rotate={34} scale={0.95} tone="lit" />
        <Leaf x={112} y={118} rotate={-12} scale={0.62 + ratio * 0.28} tone="mid" />
      </g>
    );
  }

  if (index === 2) {
    return (
      <g className="tree-sway">
        <path
          d="M112 208c-10-40 4-78-4-118"
          stroke="var(--color-leaf-deep)"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
        <Leaf x={78} y={176} rotate={-64} scale={0.8} />
        <Leaf x={142} y={160} rotate={46} scale={0.88} tone="lit" />
        <Leaf x={74} y={138} rotate={-36} scale={0.84} tone="deep" />
        <Leaf x={146} y={118} rotate={28} scale={0.92} />
        <Leaf x={104} y={96} rotate={-8} scale={0.78 + ratio * 0.28} tone="lit" />
      </g>
    );
  }

  if (index === 3) {
    return (
      <g className="tree-sway">
        <path d="M96 206c-2-28 4-48 8-70" stroke="var(--color-bark)" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M110 208c2-36 0-64 4-86" stroke="var(--color-bark)" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <path d="M126 206c4-26 0-50-6-72" stroke="var(--color-bark)" strokeWidth="3" fill="none" strokeLinecap="round" />
        <Crown
          cx={110}
          cy={112}
          rx={48}
          ry={34}
          leaves={[
            { x: 62, y: 124, r: -70, s: 0.62 },
            { x: 158, y: 120, r: 68, s: 0.62, tone: "lit" },
            { x: 86, y: 78, r: -24, s: 0.58, tone: "lit" },
            { x: 138, y: 76, r: 22, s: 0.58 },
            { x: 110, y: 68, r: -4, s: 0.5, tone: "lit" },
          ]}
        />
        <circle cx="124" cy="118" r="3.4" fill="var(--color-work)" />
      </g>
    );
  }

  const form =
    index === 4
      ? {
          top: 132,
          thick: 9,
          crown: { cx: 110, cy: 96, rx: 58, ry: 42 },
          branches: [
            ["M104 148C78 140 62 124 54 108", 3.2],
            ["M116 144C146 136 160 122 168 106", 3.2],
          ] as [string, number][],
          leaves: [
            { x: 46, y: 112, r: -70, s: 0.7 },
            { x: 174, y: 108, r: 68, s: 0.7, tone: "lit" as const },
            { x: 78, y: 52, r: -20, s: 0.62, tone: "lit" as const },
            { x: 146, y: 50, r: 18, s: 0.62 },
            { x: 110, y: 40, r: 0, s: 0.58, tone: "lit" as const },
          ],
          fruits: [
            [86, 104],
            [136, 98],
          ] as [number, number][],
          motes: [] as [number, number][],
        }
      : index === 5
        ? {
            top: 124,
            thick: 12,
            crown: { cx: 110, cy: 88, rx: 70, ry: 50 },
            branches: [
              ["M100 146C70 136 48 118 40 100", 4],
              ["M120 142C154 132 176 116 186 98", 4],
            ] as [string, number][],
            leaves: [
              { x: 34, y: 104, r: -68, s: 0.72 },
              { x: 188, y: 100, r: 66, s: 0.72, tone: "lit" as const },
              { x: 70, y: 40, r: -18, s: 0.66, tone: "lit" as const },
              { x: 154, y: 38, r: 16, s: 0.66 },
              { x: 110, y: 26, r: 0, s: 0.6, tone: "lit" as const },
            ],
            fruits: [
              [78, 96],
              [112, 72],
              [148, 100],
              [124, 122],
            ] as [number, number][],
            motes: [
              [28, 70],
              [192, 64],
              [168, 140],
            ] as [number, number][],
          }
        : {
            top: 118,
            thick: 17,
            crown: { cx: 110, cy: 82, rx: 78, ry: 52 },
            branches: [
              ["M96 142C62 130 36 112 26 92", 4.5],
              ["M124 138C162 126 190 110 200 90", 4.5],
            ] as [string, number][],
            leaves: [
              { x: 28, y: 98, r: -66, s: 0.76 },
              { x: 192, y: 94, r: 64, s: 0.76, tone: "lit" as const },
              { x: 64, y: 30, r: -16, s: 0.7, tone: "lit" as const },
              { x: 160, y: 28, r: 14, s: 0.7 },
              { x: 110, y: 16, r: 0, s: 0.64, tone: "lit" as const },
            ],
            fruits: [
              [68, 92],
              [98, 60],
              [132, 56],
              [160, 96],
              [122, 118],
              [86, 120],
            ] as [number, number][],
            motes: [
              [16, 58],
              [204, 52],
              [188, 132],
              [34, 128],
            ] as [number, number][],
          };

  return (
    <g className="tree-sway">
      {index >= 4 ? (
        <ellipse
          cx="110"
          cy={form.crown.cy}
          rx={form.crown.rx + 18}
          ry={form.crown.ry + 14}
          fill="var(--color-break)"
          opacity={index >= 6 ? 0.22 : 0.14}
          className="tree-glow"
        />
      ) : null}
      <Trunk top={form.top} base={210} thick={form.thick} />
      {form.branches.map(([d, width]) => (
        <path key={d} d={d} stroke="var(--color-bark)" strokeWidth={width} fill="none" strokeLinecap="round" />
      ))}
      <g transform={`translate(110 ${form.crown.cy}) scale(${0.94 + ratio * 0.08}) translate(-110 ${-form.crown.cy})`}>
        <Crown cx={form.crown.cx} cy={form.crown.cy} rx={form.crown.rx} ry={form.crown.ry} leaves={form.leaves} />
        <Fruits points={form.fruits} />
      </g>
      {form.motes.length > 0 ? <Motes points={form.motes} /> : null}
    </g>
  );
}

export function GrowthTree({ minutes, className }: { minutes: number; className?: string }) {
  const { index } = treeProgress(minutes);
  const blades = [3, 4, 5, 6, 7, 8, 9][index] ?? 3;
  const { ratio } = treeProgress(minutes);

  return (
    <svg viewBox="0 0 220 236" className={className} data-tree-svg="" aria-hidden="true">
      <Ground blades={blades} />
      <Living index={index} ratio={ratio} />
    </svg>
  );
}

export function FocusGarden({
  minutes,
  score,
  phrase,
  intention = "",
  projectName = null,
  week = [],
}: {
  minutes: number;
  score: number;
  phrase: string;
  intention?: string;
  projectName?: string | null;
  week?: WeekMark[];
}) {
  const progress = treeProgress(minutes);
  const width = progress.nextName ? `${Math.round(progress.ratio * 100)}%` : "100%";

  return (
    <section
      className="w-full max-w-sm overflow-hidden rounded-[1.75rem] bg-raised ring-1 ring-border"
      aria-label={`الدرجة ${score}. الشجرة ${progress.name}`}
    >
      <div className="tree-stage relative">
        <GrowthTree minutes={minutes} className="h-64 w-full" />
        <p className="absolute inset-x-3 bottom-2 truncate text-center text-sm font-medium tracking-wide text-break">
          {projectName ? `${projectName} · ${progress.name}` : progress.name}
        </p>
      </div>
      <div className="space-y-2 px-4 pt-1 pb-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-faint">الدرجة</p>
            <p className="font-display text-4xl leading-none font-medium tabular-nums text-fg">{score}</p>
          </div>
          <p className="max-w-[11rem] text-left text-xs text-pretty text-faint">
            {progress.nextName
              ? `باقي ${progress.remain} دقيقة لتصبح ${progress.nextName}`
              : `سُقيت ${minutes} دقيقة، وما زالت تكبر`}
          </p>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-border" aria-hidden="true">
          <div className="h-full rounded-full bg-break" style={{ width }} />
        </div>
        {week.length > 0 ? (
          <div className="flex justify-between gap-1 pt-1" aria-label="حديقة الأسبوع">
            {week.map((day) => (
              <div key={day.key} className="flex flex-1 flex-col items-center gap-1">
                <span
                  className={`size-2.5 rounded-full ${
                    day.minutes > 0 ? "bg-break" : day.today ? "ring-1 ring-work" : "bg-border"
                  }`}
                  title={day.minutes > 0 ? `${day.minutes} دقيقة` : undefined}
                />
                <span className={`text-xs ${day.today ? "text-fg" : "text-faint"}`}>{day.label}</span>
              </div>
            ))}
          </div>
        ) : null}
        <p key={phrase} className="phrase-in text-sm text-pretty text-fg">
          {phrase}
        </p>
        {intention ? <p className="text-sm text-pretty text-muted">من أجل: {intention}</p> : null}
      </div>
    </section>
  );
}
