import { AlertTriangle, CalendarCheck, Lightbulb } from "lucide-react";
import { ScoreBar, ScoreRow, toneOf } from "./report-primitives";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export type ReportDim = {
  code: string;
  name: string;
  normalized: number;
  moduleName?: string;
  moduleCode?: string;
};

export type ReportModule = {
  code: string;
  name: string;
  normalized: number;
  category: string;
  interpretation?: string | null;
  isSensitive?: boolean | null;
  dimensions: ReportDim[];
  recommendations: { title: string; body: string }[];
};

export function ModuleCard({ module: m }: { module: ReportModule }) {
  const tone = toneOf(m.normalized ?? 0);
  const dimensions = m.dimensions ?? [];
  return (
    <div className={`animate-fade-in rounded-2xl border p-5 ${tone.soft}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{m.code}</Badge>
          <p className="text-sm font-semibold leading-snug">{m.name}</p>
        </div>
        <Badge variant="outline" className={tone.ring}>
          {m.category || "-"}
        </Badge>
      </div>
      <div className="mt-3 flex items-end gap-2">
        <span className={`font-display text-3xl font-semibold tabular-nums ${tone.text}`}>
          {Math.round(m.normalized ?? 0)}
        </span>
        <span className="pb-1 text-xs text-muted-foreground">/ 100 · {tone.label}</span>
      </div>
      <ScoreBar value={m.normalized ?? 0} className="mt-2 h-1.5" />
      {m.isSensitive ? (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-2.5 text-[11px] leading-relaxed">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          Hasil skrining ini bersifat indikatif dan bukan diagnosis.
        </p>
      ) : null}
      {m.interpretation ? (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{m.interpretation}</p>
      ) : null}
      {dimensions.length > 0 ? (
        <div className="mt-4 space-y-2.5 border-t border-border/60 pt-4">
          {dimensions.map((d) => (
            <ScoreRow key={d.code} label={d.name} value={d.normalized ?? 0} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function RecommendationGrid({ modules }: { modules: ReportModule[] }) {
  const items = (modules ?? []).flatMap((m) =>
    (m.recommendations ?? []).map((r) => ({ ...r, moduleCode: m.code, moduleName: m.name })),
  );
  if (!items.length) return null;
  return (
    <Card className="mt-6">
      <CardHeader>
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Lightbulb className="size-4 text-accent" /> Rekomendasi Pengembangan
        </h2>
        <p className="text-sm text-muted-foreground">
          Langkah konkret berdasarkan kategori skor pada setiap sub-tes.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((r) => (
          <div
            key={`${r.moduleCode}-${r.title}`}
            className="animate-fade-in rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold leading-snug">{r.title}</p>
              <Badge variant="secondary" className="shrink-0 text-[10px]">
                {r.moduleCode}
              </Badge>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{r.body}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function ActionPlan({ areas }: { areas: ReportDim[] }) {
  const safeAreas = areas ?? [];
  if (!safeAreas.length) return null;
  const phases = [
    {
      label: "30 Hari",
      title: "Perkuat fondasi",
      lead: "Fokus pada satu area terlemah.",
      area: safeAreas[0],
      verbs: ["Pelajari materi dasar", "Latihan harian 20 menit", "Catat progres mingguan"],
    },
    {
      label: "60 Hari",
      title: "Latihan terukur",
      lead: "Tambah beban dan ukur hasilnya.",
      area: safeAreas[1] ?? safeAreas[0],
      verbs: ["Simulasi terjadwal", "Evaluasi skor tiap 2 minggu", "Minta umpan balik mentor"],
    },
    {
      label: "90 Hari",
      title: "Siap uji",
      lead: "Konsolidasi menuju seleksi.",
      area: safeAreas[2] ?? safeAreas[0],
      verbs: ["Simulasi penuh", "Perbaiki titik lemah sisa", "Kunci rutinitas harian"],
    },
  ];
  return (
    <Card className="mt-6">
      <CardHeader>
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <CalendarCheck className="size-4 text-primary" /> Rencana 30 / 60 / 90 Hari
        </h2>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        {phases.map((p) => (
          <div
            key={p.label}
            className="animate-fade-in rounded-xl border border-border bg-secondary/40 p-4"
          >
            <Badge className="bg-primary text-primary-foreground">{p.label}</Badge>
            <p className="mt-3 text-sm font-semibold">{p.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{p.lead}</p>
            <p className="mt-3 text-xs font-medium text-primary">{p.area?.name}</p>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
              {p.verbs.map((v) => (
                <li key={v} className="flex gap-1.5">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-accent" />
                  <span>{v}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
