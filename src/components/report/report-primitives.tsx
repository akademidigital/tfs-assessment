import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";

export function toneOf(value: number) {
  if (value >= 75)
    return {
      bar: "bg-success",
      text: "text-success",
      ring: "border-success/40 bg-success/10 text-success",
      soft: "border-success/30 bg-success/5",
      label: "Kuat",
    };
  if (value >= 50)
    return {
      bar: "bg-chart-2",
      text: "text-chart-2",
      ring: "border-accent/40 bg-accent/10 text-accent",
      soft: "border-accent/30 bg-accent/5",
      label: "Berkembang",
    };
  return {
    bar: "bg-warning",
    text: "text-warning",
    ring: "border-warning/40 bg-warning/10 text-warning",
    soft: "border-warning/30 bg-warning/5",
    label: "Perlu Penguatan",
  };
}

export function ScoreBar({ value, className = "h-2" }: { value: number; className?: string }) {
  const tone = toneOf(value);
  return (
    <div className={`w-full overflow-hidden rounded-full bg-muted ${className}`}>
      <div
        className={`h-full rounded-full ${tone.bar} transition-[width] duration-1000 ease-out`}
        style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function ScoreRow({
  label,
  sub,
  value,
}: {
  label: string;
  sub?: string | null;
  value: number;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium leading-snug">{label}</span>
        <span className={`tabular-nums text-sm font-semibold ${toneOf(value).text}`}>
          {Math.round(value)}%
        </span>
      </div>
      <ScoreBar value={value} className="mt-1.5 h-1.5" />
      {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

const GAUGE_BANDS = ["Rendah", "Sedang", "Tinggi", "Sangat Tinggi"];

export function ReadinessGauge({ value, category }: { value: number; category: string }) {
  const pct = Math.max(0, Math.min(100, value)) / 100;
  const r = 78;
  const cx = 100;
  const cy = 96;
  const arcLength = Math.PI * r;
  const point = (t: number) => {
    const a = Math.PI * (1 - t);
    return `${cx + r * Math.cos(a)} ${cy - r * Math.sin(a)}`;
  };
  const track = `M ${point(0)} A ${r} ${r} 0 0 1 ${point(1)}`;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 118" className="w-full max-w-[260px]">
        <path
          d={track}
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth={14}
          strokeLinecap="round"
        />
        <path
          d={track}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={14}
          strokeLinecap="round"
          strokeDasharray={`${arcLength * pct} ${arcLength}`}
          className="transition-[stroke-dasharray] duration-1000 ease-out"
        />
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          className="fill-foreground font-display text-[38px] font-semibold"
        >
          {Math.round(value)}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="fill-muted-foreground text-[10px]">
          {category}
        </text>
      </svg>
      <div className="mt-1 grid w-full max-w-[280px] grid-cols-4 text-center text-[10px] text-muted-foreground">
        {GAUGE_BANDS.map((b) => (
          <span key={b}>{b}</span>
        ))}
      </div>
    </div>
  );
}

export function RadarCard({
  title,
  data,
  hint,
}: {
  title: string;
  data: { subject: string; value: number }[];
  hint?: string;
}) {
  return (
    <Card className="animate-fade-in">
      <CardContent className="pt-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {title}
          </h2>
        </div>
        <div className="mt-2 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} outerRadius="72%">
              <PolarGrid stroke="var(--color-border)" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
              />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Radar
                dataKey="value"
                stroke="var(--color-primary)"
                fill="var(--color-chart-2)"
                fillOpacity={0.3}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
