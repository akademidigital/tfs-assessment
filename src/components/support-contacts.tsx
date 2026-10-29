import { Mail, MapPin, MessageCircle } from "lucide-react";
import { SUPPORT_BRANCHES, waLink } from "@/lib/support-contacts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SupportContacts({
  participantName,
  code,
  readiness,
}: {
  participantName?: string | null;
  code?: string | null;
  readiness?: number | null;
}) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-base">Kontak Dukungan Profesional</CardTitle>
        <p className="text-sm text-muted-foreground">
          Konsultasikan hasil asesmen Anda langsung dengan tim konsultan Akademi Prestasi melalui
          WhatsApp cabang terdekat.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        {SUPPORT_BRANCHES.map((b) => (
          <div
            key={`${b.name}-${b.whatsapp}`}
            className="flex flex-col rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md"
          >
            <p className="font-display text-sm font-semibold text-primary">{b.name}</p>
            <p className="mt-1 flex gap-1.5 text-xs leading-relaxed text-muted-foreground">
              <MapPin className="mt-0.5 size-3.5 shrink-0" />
              <span>{b.address}</span>
            </p>
            {b.email ? (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Mail className="size-3.5 shrink-0" /> {b.email}
              </p>
            ) : null}
            <Button
              asChild
              size="sm"
              className="mt-3 mt-auto w-full bg-success text-success-foreground hover:bg-success/90"
            >
              <a
                href={waLink(b.whatsapp, {
                  branch: b.name,
                  name: participantName ?? null,
                  code: code ?? null,
                  readiness: readiness ?? null,
                })}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle className="mr-2 size-4" /> Chat WhatsApp · {b.whatsapp}
              </a>
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
