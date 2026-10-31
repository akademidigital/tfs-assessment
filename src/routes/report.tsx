import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useParticipantId } from "@/hooks/use-participant";
import { Download, TrendingDown, TrendingUp } from "lucide-react";
import { getReport } from "@/lib/assessment.functions";
import { AppHeader } from "@/components/app-header";
import { SupportContacts } from "@/components/support-contacts";
import { LoadingScreen } from "@/components/loading-screen";
import { RadarCard, ReadinessGauge, ScoreRow, toneOf } from "@/components/report/report-primitives";
import {
  ActionPlan,
  ModuleCard,
  RecommendationGrid,
  type ReportModule,
} from "@/components/report/report-sections";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const TITLE = "Laporan Kesiapan — Taruna Future Scanner";
const DESCRIPTION =
  "Laporan kesiapan calon taruna: indeks kesiapan, profil sembilan sub-tes, kekuatan, area pengembangan, dan rekomendasi.";

interface ReportSearchParams {
  participantId?: string | undefined;
}

export const Route = createFileRoute("/report")({
  validateSearch: (search: Record<string, unknown>): ReportSearchParams => ({
    participantId:
      typeof search["participantId"] === "string" && search["participantId"].trim()
        ? search["participantId"].trim()
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Report,
  errorComponent: ReportErrorComponent,
});

function ReportErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error("Gagal memuat halaman laporan:", error);
  const location = useLocation();
  const searchParticipantId =
    (location.search as { participantId?: string })?.participantId ||
    (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("participantId") || undefined
      : undefined);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Laporan Belum Dapat Ditampilkan
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Terjadi kendala saat memproses data laporan. Pastikan seluruh sub-tes siswa telah diselesaikan dan dihitung.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={() => reset()} variant="default">
            Coba Lagi
          </Button>
          {searchParticipantId ? (
            <Button asChild variant="outline">
              <Link to="/admin">Kembali ke Panel Admin</Link>
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link to="/sub-tests">Kembali ke Sub-Tes</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Report() {
  const search = Route.useSearch();
  const searchParticipantId =
    search.participantId ||
    (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("participantId") || undefined
      : undefined);
  const storedParticipantId = useParticipantId(!searchParticipantId);
  const participantId = searchParticipantId || storedParticipantId;
  const isAdminView = Boolean(searchParticipantId);

  const [downloading, setDownloading] = useState(false);

  const fetchReport = useServerFn(getReport);
  const { data, isPending, error } = useQuery({
    queryKey: ["report", participantId],
    queryFn: () => fetchReport({ data: { participantId: participantId! } }),
    enabled: Boolean(participantId),
    staleTime: 5 * 60 * 1000,
  });

  if (!participantId) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader isAdmin={isAdminView} />
        <main className="mx-auto max-w-5xl px-4 py-12 text-center">
          <p className="text-sm text-destructive">ID Peserta tidak ditemukan.</p>
          <Button asChild variant="outline" className="mt-4">
            <Link to={isAdminView ? "/admin" : "/daftar"}>
              {isAdminView ? "Kembali ke Panel Admin" : "Daftar Asesmen"}
            </Link>
          </Button>
        </main>
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader isAdmin={isAdminView} />
        <main className="mx-auto max-w-5xl px-4 py-8">
          <LoadingScreen
            label="Menyiapkan laporan..."
            hint="Mengambil skor dan analisis rekomendasi."
          />
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader isAdmin={isAdminView} />
        <main className="mx-auto max-w-5xl px-4 py-12 text-center">
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Laporan belum tersedia."}
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link to={isAdminView ? "/admin" : "/sub-tests"}>
              {isAdminView ? "Kembali ke Panel Admin" : "Kembali ke daftar sub-tes"}
            </Link>
          </Button>
        </main>
      </div>
    );
  }

  if (!data.overall) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader isAdmin={isAdminView} />
        <main className="mx-auto max-w-5xl px-4 py-12 text-center">
          <h1 className="text-xl font-semibold">Laporan belum dihitung</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isAdminView
              ? "Siswa ini belum menyelesaikan seluruh sub-tes atau skor akhir belum diproses."
              : "Selesaikan seluruh sub-tes lalu proses hasil untuk melihat laporan."}
          </p>
          <Button asChild className="mt-5">
            <Link to={isAdminView ? "/admin" : "/processing"}>
              {isAdminView ? "Kembali ke Panel Admin" : "Proses hasil sekarang"}
            </Link>
          </Button>
        </main>
      </div>
    );
  }

  const participantInfo = data.participant ?? {};
  const studentCode = (participantInfo as { code?: string | null }).code ?? null;
  const modules = (data.modules ?? []) as ReportModule[];
  const sortedModules = [...modules].sort((a, b) => (b.normalized ?? 0) - (a.normalized ?? 0));
  const topModule = sortedModules[0] ?? null;
  const highlights = sortedModules.slice(0, 4);
  const moduleRadar = modules.map((m) => ({ subject: m.code || "-", value: m.normalized ?? 0 }));
  const dimensionRadar = modules.map((m) => {
    const dims = m.dimensions ?? [];
    const avg = dims.length
      ? dims.reduce((sum, d) => sum + (d?.normalized ?? 0), 0) / dims.length
      : (m.normalized ?? 0);
    return {
      subject: (m.name || m.code || "").replace(/\s*(Index|Readiness|Screener)$/i, "").trim() || m.code,
      value: Math.round(avg),
    };
  });
  const meta = [
    participantInfo.targetInstitution,
    participantInfo.targetProgram,
    participantInfo.city,
  ]
    .filter(Boolean)
    .join(" · ");
  const strengths = data.strengths ?? [];
  const developmentAreas = data.developmentAreas ?? [];

  const download = async () => {
    if (downloading || !data) return;
    setDownloading(true);
    try {
      const { downloadReportPdf } = await import("@/lib/report-pdf");
      await downloadReportPdf(data as never);
    } catch (err) {
      console.error("Gagal membuat PDF:", err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader subtitle="Laporan Kesiapan" code={studentCode} isAdmin={isAdminView} />
      <main className="mx-auto max-w-5xl px-4 py-8">
        {isAdminView ? (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary shadow-sm animate-fade-in print:hidden">
            <div className="flex items-center gap-2">
              <span className="flex size-2 rounded-full bg-primary animate-pulse" />
              <span className="font-semibold">
                Mode Pratinjau Administrator — Menampilkan Laporan: {participantInfo.fullName || "Peserta"}
              </span>
            </div>
            <Button asChild size="sm" variant="default" className="h-8 text-xs font-semibold">
              <Link to="/admin">← Kembali ke Panel Admin</Link>
            </Button>
          </div>
        ) : null}

        {/* Header dokumen */}
        <div className="flex flex-wrap items-start justify-between gap-4 animate-fade-in">
          <div>
            <Badge className="bg-success/15 text-success hover:bg-success/15">LAPORAN FINAL</Badge>
            <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight">
              Laporan Kesiapan Calon Taruna
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {participantInfo.fullName || "Peserta"}
              {meta ? ` · ${meta}` : ""}
            </p>
          </div>
          <Button
            onClick={download}
            disabled={downloading}
            className="bg-primary text-primary-foreground print:hidden"
          >
            <Download className="mr-2 size-4" />
            {downloading ? "Menyiapkan PDF..." : "Download PDF"}
          </Button>
        </div>

        {/* Strip identitas */}
        <Card className="mt-5 animate-fade-in">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Akademi Prestasi · Taruna Future Scanner
              </p>
              <p className="mt-1.5 font-display text-lg font-semibold">
                {participantInfo.fullName || "Peserta"}
              </p>
              <p className="text-xs text-muted-foreground">
                {meta || "Data peserta belum lengkap"}
              </p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>
                Kode Asesmen:{" "}
                <span className="font-semibold text-foreground">
                  {studentCode || "—"}
                </span>
              </p>
              <p className="mt-1">
                Dibuat {data.generatedAt ? new Date(data.generatedAt).toLocaleDateString("id-ID") : "—"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Hero: gauge + highlight */}
        <div className="mt-5 grid gap-5 animate-scale-in lg:grid-cols-[1fr_1.2fr]">
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Indeks Kesiapan
              </h2>
              <div className="mt-3">
                <ReadinessGauge value={data.overall.readiness} category={data.overall.category} />
              </div>
              <div className="mt-3 flex justify-center">
                <Badge variant="outline" className={toneOf(data.overall.readiness).ring}>
                  {data.overall.category}
                </Badge>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-secondary/30">
            <CardContent className="pt-6">
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Sub-tes terkuat
              </h2>
              <p className="mt-1.5 font-display text-xl font-semibold text-primary">
                {topModule?.name || "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                {topModule ? `${topModule.code} · ${topModule.category}` : "Belum dihitung"}
              </p>
              <div className="mt-4 space-y-3">
                {highlights.map((m) => (
                  <ScoreRow key={m.code} label={m.name} value={m.normalized ?? 0} />
                ))}
              </div>
              {data.overall.interpretation ? (
                <p className="mt-4 border-t border-border/60 pt-3 text-xs leading-relaxed text-muted-foreground">
                  {data.overall.interpretation}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <Button
          size="lg"
          onClick={download}
          className="mt-5 h-14 w-full bg-accent text-base font-semibold text-accent-foreground shadow-lg transition-transform hover:scale-[1.01] hover:bg-accent/90 lg:hidden print:hidden"
        >
          <Download className="mr-2 size-5" /> Download Hasil (PDF)
        </Button>

        {/* Radar berdampingan */}
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <RadarCard title="Profil Sembilan Sub-Tes" data={moduleRadar} />
          <RadarCard title="Profil Rata-rata Dimensi" data={dimensionRadar} />
        </div>

        {/* Kekuatan & area pengembangan */}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card className="animate-fade-in border-success/40 bg-success/5">
            <CardHeader>
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <TrendingUp className="size-4 text-success" /> Tiga Kekuatan Utama
              </h2>
            </CardHeader>
            <CardContent className="space-y-4">
              {strengths.length > 0 ? (
                strengths.map((d) => (
                  <ScoreRow
                    key={`${d.moduleCode}-${d.code}`}
                    label={d.name}
                    sub={d.moduleName}
                    value={d.normalized ?? 0}
                  />
                ))
              ) : (
                <p className="text-xs text-muted-foreground">Data kekuatan belum tersedia.</p>
              )}
            </CardContent>
          </Card>
          <Card className="animate-fade-in border-warning/40 bg-warning/5">
            <CardHeader>
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <TrendingDown className="size-4 text-warning" /> Tiga Area Pengembangan
              </h2>
            </CardHeader>
            <CardContent className="space-y-4">
              {developmentAreas.length > 0 ? (
                developmentAreas.map((d) => (
                  <ScoreRow
                    key={`${d.moduleCode}-${d.code}`}
                    label={d.name}
                    sub={d.moduleName}
                    value={d.normalized ?? 0}
                  />
                ))
              ) : (
                <p className="text-xs text-muted-foreground">Data area pengembangan belum tersedia.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Grid rincian sub-tes */}
        <Card className="mt-6">
          <CardHeader>
            <h2 className="text-base font-semibold">Rincian per Sub-Tes</h2>
            <p className="text-sm text-muted-foreground">
              Skor sembilan sub-tes beserta 45 dimensi pendukungnya.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {modules.map((m) => (
              <ModuleCard key={m.code} module={m} />
            ))}
          </CardContent>
        </Card>

        <RecommendationGrid modules={modules} />
        <ActionPlan areas={developmentAreas} />

        <SupportContacts
          participantName={participantInfo.fullName}
          code={studentCode}
          readiness={data.overall.readiness}
        />

        <p className="mt-8 text-center text-xs leading-relaxed text-muted-foreground">
          Laporan ini bersifat rahasia dan digunakan untuk keperluan pembinaan. Hasil bukan
          diagnosis medis maupun keputusan seleksi resmi. ID Asesmen: {data.assessmentId} · Dibuat{" "}
          {data.generatedAt ? new Date(data.generatedAt).toLocaleString("id-ID") : "—"}
        </p>
      </main>
    </div>
  );
}
