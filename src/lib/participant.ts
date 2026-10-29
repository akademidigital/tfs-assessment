const ID_KEY = "tfs.participantId";
const CODE_KEY = "tfs.participantCode";

export function getParticipantId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ID_KEY);
}

export function getParticipantCode(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(CODE_KEY);
}

export function setParticipant(id: string, code?: string | null) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ID_KEY, id);
  if (code) window.localStorage.setItem(CODE_KEY, code);
}

export function clearParticipant() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ID_KEY);
  window.localStorage.removeItem(CODE_KEY);
}
