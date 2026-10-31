import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { getParticipantId } from "@/lib/participant";

/** Returns the current participant id from local storage, optionally redirecting to the
 * registration form when none exists yet. */
export function useParticipantId(redirect = true) {
  const router = useRouter();
  const [participantId, setParticipantId] = useState<string | null>(() => getParticipantId());

  useEffect(() => {
    const stored = getParticipantId();
    if (!stored) {
      if (redirect) {
        router.navigate({ to: "/daftar" });
      }
      return;
    }
    if (stored !== participantId) {
      setParticipantId(stored);
    }
  }, [router, participantId, redirect]);

  return participantId;
}
