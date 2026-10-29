import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import {
  Activity,
  BarChart3,
  Brain,
  CheckCircle2,
  Dumbbell,
  GraduationCap,
  HeartPulse,
  Play,
  Shield,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { getDashboard, getModuleResult } from "@/lib/assessment.functions";
import { useParticipantId } from "@/hooks/use-participant";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { LoadingScreen } from "@/components/loading-screen";
import { cn } from "@/lib/utils";

const TITLE = "Pilih Modul Assessment — Taruna Future Scanner";
const DESCRIPTION = "Pilih dan kerjakan sembilan modul assessment kesiapan calon taruna.";

export const Route = createFileRoute("/sub-tests")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: SubTests,
});

const ICONS: Record<string, typeof Brain> = {
  TMI: Brain,
  MTI: Shield,
  LPI: Users,
  DRI: Target,
  ARI: GraduationCap,
  PPR: Dumbbell,
  SPI: Activity,
  TCI: Sparkles,
  MHS: HeartPulse,
};

function SubTests() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const participantId = useParticipantId();
  const fetchDashboard = useServerFn(getDashboard);
  const fetchModuleResult = useServerFn(getModuleResult);
  const { data, isPending, error } = useQuery({
    queryKey: ["dashboard", participantId],
    queryFn: () => fetchDashboard({ data: { participantId: participantId! } }),
    enabled: Boolean(participantId),
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    if (data && !data.profile.consentAt) router.navigate({ to: "/daftar" });
  }, [data, router]);

  const modules = data?.modules ?? [];
  const completed = modules.filter((m) => m.status === "completed").length;
  const pct = modules.length > 0 ? Math.round((completed / modules.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader subtitle={data?.profile.fullName || undefined} />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold md:text-3xl">Pilih Modul Assessment</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Kerjakan modul dalam urutan bebas. Jawaban tersimpan otomatis.
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl font-bold text-primary">
              {completed}/{modules.length || 9}
            </p>
            <p className="text-xs text-muted-foreground">modul selesai</p>
          </div>
        </div>

        <Progress value={pct} className="mt-5" />

        {error ? (
          <p className="mt-6 text-sm text-destructive">Gagal memuat data. Muat ulang halaman.</p>
        ) : null}

        {isPending ? <LoadingScreen label="Memuat daftar sub-tes..." /> : null}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isPending
            ? null
            : modules.map((m) => {
                const Icon = ICONS[m.code] ?? Brain;
                const done = m.status === "completed";
                const mp = m.total > 0 ? Math.round((m.answered / m.total) * 100) : 0;
                return (
                  <Card
                    key={m.code}
                    className={cn(
                      "border-border/70 transition-shadow hover:shadow-md",
                      done && "border-success/60 bg-success/5",
                    )}
                  >
                    <CardContent className="flex h-full flex-col gap-3 pt-6">
                      <div className="flex items-start justify-between">
                        <span
                          className={cn(
                            "flex size-11 items-center justify-center rounded-xl",
                            done ? "bg-success/15 text-success" : "bg-primary/10 text-primary",
                          )}
                        >
                          <Icon className="size-5" />
                        </span>
                        {done ? (
                          <span className="flex items-center gap-1 text-xs font-semibold text-success">
                            <CheckCircle2 className="size-4" /> Selesai
                          </span>
                        ) : m.answered > 0 ? (
                          <span className="text-xs font-medium text-muted-foreground">{mp}%</span>
                        ) : null}
                      </div>

                      <div>
                        <p className="font-display text-lg font-bold tracking-wide">{m.code}</p>
                        <p className="text-sm font-medium">{m.name}</p>
                      </div>

                      <p className="text-xs text-muted-foreground">{m.total} pernyataan</p>

                      {done ? (
                        <div className="mt-auto space-y-3">
                          <div className="flex items-baseline gap-2">
                            <span className="font-display text-2xl font-bold text-success">
                              {m.score ?? 0}%
                            </span>
                            <span className="text-xs text-muted-foreground">{m.category}</span>
                          </div>
                          <Button
                            asChild
                            variant="outline"
                            className="w-full"
                            onMouseEnter={() => {
                              if (participantId) {
                                void queryClient.prefetchQuery({
                                  queryKey: ["module-result", m.code, participantId],
                                  queryFn: () =>
                                    fetchModuleResult({
                                      data: { moduleCode: m.code, participantId },
                                    }),
                                  staleTime: 2 * 60 * 1000,
                                });
                              }
                            }}
                          >
                            <Link to="/result/$moduleCode" params={{ moduleCode: m.code }}>
                              <BarChart3 className="mr-2 size-4" /> Lihat Hasil
                            </Link>
                          </Button>
                        </div>
                      ) : (
                        <div className="mt-auto space-y-3">
                          {m.answered > 0 ? <Progress value={mp} className="h-1.5" /> : null}
                          <Button asChild className="w-full">
                            <Link to="/assessment/$moduleCode" params={{ moduleCode: m.code }}>
                              <Play className="mr-2 size-4" />
                              {m.answered > 0 ? "Lanjutkan" : "Mulai"}
                            </Link>
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
        </div>

        {data?.allCompleted ? (
          <Card className="mt-8 border-primary/40 bg-primary/5">
            <CardContent className="flex flex-col gap-4 pt-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-display text-lg font-bold">Semua modul selesai</h2>
                <p className="text-sm text-muted-foreground">
                  Lihat laporan kesiapan Anda beserta rekomendasi pengembangan.
                </p>
              </div>
              <Button asChild>
                <Link to={data.scoringCalculated ? "/report" : "/processing"}>
                  <BarChart3 className="mr-2 size-4" /> Lihat Laporan
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </main>
    </div>
  );
}
