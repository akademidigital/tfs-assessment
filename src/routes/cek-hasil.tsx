import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { BarChart3, ShieldCheck } from "lucide-react";
import { findParticipantFn } from "@/lib/assessment.functions";
import { setParticipant } from "@/lib/participant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TITLE = "Cek Hasil Assessment — Taruna Future Scanner";
const DESCRIPTION =
  "Buka kembali hasil asesmen dengan kode peserta atau nomor WhatsApp dan tanggal lahir yang didaftarkan.";

export const Route = createFileRoute("/cek-hasil")({
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
  component: CekHasil,
});

function CekHasil() {
  const router = useRouter();
  const find = useServerFn(findParticipantFn);
  const [code, setCode] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [loading, setLoading] = useState(false);

  async function lookup(payload: { code?: string; whatsapp?: string; birthDate?: string }) {
    setLoading(true);
    try {
      const found = await find({ data: payload });
      if (!found) {
        toast.error("Data peserta tidak ditemukan. Periksa kembali data Anda.");
        return;
      }
      setParticipant(found.participantId, found.code);
      toast.success(`Selamat datang kembali, ${found.fullName || "peserta"}.`);
      router.navigate({ to: "/sub-tests" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mencari data peserta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="surface-gradient px-4 py-6 text-primary-foreground">
        <Link to="/" className="mx-auto flex max-w-5xl items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <ShieldCheck className="size-5" />
          </span>
          <span className="font-display text-base font-semibold">Taruna Future Scanner</span>
        </Link>
      </div>

      <main className="mx-auto flex w-full max-w-md flex-1 items-center px-4 py-10">
        <Card className="w-full">
          <CardHeader>
            <h1 className="font-display text-xl">Cek Hasil Assessment</h1>
            <CardDescription>
              Gunakan kode peserta, atau nomor WhatsApp dan tanggal lahir yang Anda daftarkan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="code">
              <TabsList className="w-full">
                <TabsTrigger className="flex-1" value="code">
                  Kode Peserta
                </TabsTrigger>
                <TabsTrigger className="flex-1" value="wa">
                  WA + Tgl Lahir
                </TabsTrigger>
              </TabsList>

              <TabsContent value="code">
                <form
                  className="mt-4 space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void lookup({ code });
                  }}
                >
                  <div className="space-y-2">
                    <Label htmlFor="code">Kode peserta</Label>
                    <Input
                      id="code"
                      required
                      placeholder="TFS-8F3K"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    <BarChart3 className="mr-2 size-4" />
                    {loading ? "Mencari…" : "Buka Hasil"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="wa">
                <form
                  className="mt-4 space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void lookup({ whatsapp, birthDate });
                  }}
                >
                  <div className="space-y-2">
                    <Label htmlFor="wa">Nomor WhatsApp</Label>
                    <Input
                      id="wa"
                      type="tel"
                      required
                      placeholder="08xxxxxxxxxx"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tgl">Tanggal lahir</Label>
                    <Input
                      id="tgl"
                      type="date"
                      required
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    <BarChart3 className="mr-2 size-4" />
                    {loading ? "Mencari…" : "Buka Hasil"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Belum pernah mengikuti asesmen?{" "}
              <Link to="/daftar" className="font-medium text-primary underline">
                Daftar di sini
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
