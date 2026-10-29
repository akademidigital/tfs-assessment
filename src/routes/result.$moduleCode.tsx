import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useParticipantId } from "@/hooks/use-participant";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { getModuleResult } from "@/lib/assessment.functions";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { LoadingScreen } from "@/components/loading-screen";

export const Route = createFileRoute("/result/$moduleCode")({
  head: ({ params }) => {
    const title = `Hasil Modul ${params.moduleCode} — Taruna Future Scanner`;
    const description = `Ringkasan skor dan dimensi untuk modul ${params.moduleCode}.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: ModuleResult,
});

function ModuleResult() {
  const { moduleCode } = Route.useParams();
  const participantId = useParticipantId();
  const queryClient = useQueryClient();
  const fetch = useServerFn(getModuleResult);
  const { data, isPending, error } = useQuery({
    queryKey: ["module-result", moduleCode, participantId],
    queryFn: () => fetch({ data: { moduleCode, participantId: participantId! } }),
    enabled: Boolean(participantId),
    refetchOnMount: "always",
    staleTime: 0,
  });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader subtitle={data?.module.name ?? moduleCode} />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <Button
          asChild
          variant="ghost"
          size="sm"
          onClick={() => {
            void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
          }}
        >
          <Link to="/sub-tests">
            <ArrowLeft className="mr-2 size-4" /> Kembali ke modul
          </Link>
        </Button>

        {isPending ? (
          <LoadingScreen label="Memuat hasil sub-tes..." />
        ) : error || !data ? (
          <p className="mt-6 text-sm text-destructive">Hasil belum tersedia.</p>
        ) : (
          <Card className="mt-4 border-border/70">
            <CardContent className="pt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {data.module.code}
              </p>
              <h1 className="mt-1 font-display text-xl font-bold">{data.module.name}</h1>

              <div className="mt-6 flex items-center justify-between gap-4">
                <span className="font-display text-5xl font-extrabold text-primary">
                  {data.result?.normalized ?? 0}%
                </span>
                <span className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground">
                  <BarChart3 className="size-4" /> {data.result?.category ?? "Belum dihitung"}
                </span>
              </div>

              {data.result?.interpretation ? (
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  {data.result.interpretation}
                </p>
              ) : null}

              <div className="mt-7 space-y-4">
                {data.dimensions.map((d) => (
                  <div key={d.code}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-medium">
                        <span className="font-display font-bold">{d.code}</span>{" "}
                        <span className="text-muted-foreground">{d.name}</span>
                      </span>
                      <span className="font-display font-bold">{d.normalized}%</span>
                    </div>
                    <Progress value={d.normalized} className="mt-2 h-2" />
                    <p className="mt-1 text-xs text-muted-foreground">{d.status}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
