import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const participant = z.object({ participantId: z.string().uuid() });

const profileFields = {
  full_name: z
    .string()
    .min(2, { message: "Nama lengkap minimal 2 karakter." })
    .max(120, { message: "Nama lengkap maksimal 120 karakter." }),
  gender: z.string().max(20).optional().nullable(),
  class_level: z.string().max(40).optional().nullable(),
  school_name: z
    .string()
    .max(140, { message: "Nama sekolah maksimal 140 karakter." })
    .optional()
    .nullable(),
  major: z.string().max(80).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
  whatsapp: z
    .string()
    .max(30, { message: "Nomor WhatsApp maksimal 30 karakter." })
    .optional()
    .nullable(),
  email: z.string().max(160, { message: "Email maksimal 160 karakter." }).optional().nullable(),
  birth_place: z.string().max(80).optional().nullable(),
  birth_date: z.string().max(20).optional().nullable(),
  height_cm: z
    .number()
    .int({ message: "Tinggi badan harus berupa angka bulat (cm)." })
    .min(50, { message: "Tinggi badan harus antara 50–250 cm." })
    .max(250, { message: "Tinggi badan harus antara 50–250 cm." })
    .optional()
    .nullable(),
  weight_kg: z
    .number()
    .int({ message: "Berat badan harus berupa angka bulat (kg)." })
    .min(20, { message: "Berat badan harus antara 20–250 kg." })
    .max(250, { message: "Berat badan harus antara 20–250 kg." })
    .optional()
    .nullable(),
  guardian_name: z.string().max(120).optional().nullable(),
  guardian_whatsapp: z
    .string()
    .max(30, { message: "Nomor WA orang tua maksimal 30 karakter." })
    .optional()
    .nullable(),
  target_institution: z.string().max(120).optional().nullable(),
  career_target: z.string().max(160).optional().nullable(),
  referral_source: z.string().max(120).optional().nullable(),
  consent: z.boolean(),
};

// Turns Zod issues into one readable Indonesian sentence instead of raw JSON.
function friendlyParse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const first = result.error.issues[0];
  throw new Error(first?.message ?? "Data yang dikirim tidak valid. Periksa kembali isian Anda.");
}

function toRow(data: Record<string, unknown>) {
  const {
    consent,
    birth_date,
    participantId: _ignored,
    ...rest
  } = data as {
    consent: boolean;
    birth_date?: string | null;
    participantId?: string;
  } & Record<string, unknown>;
  return {
    ...rest,
    birth_date: birth_date ? birth_date : null,
    consent_version: consent ? "v1" : null,
    consent_at: consent ? new Date().toISOString() : null,
  };
}

export const registerParticipantFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => friendlyParse(z.object(profileFields), data))
  .handler(async ({ data }) => {
    const { registerParticipant } = await import("./assessment.server");
    return registerParticipant(toRow(data));
  });

export const updateParticipantFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => friendlyParse(participant.extend(profileFields), data))
  .handler(async ({ data }) => {
    const { updateParticipant } = await import("./assessment.server");
    return updateParticipant(data.participantId, toRow(data));
  });

export const findParticipantFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        code: z.string().max(20).optional().nullable(),
        whatsapp: z.string().max(30).optional().nullable(),
        birthDate: z.string().max(20).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { findParticipant } = await import("./assessment.server");
    return findParticipant(data);
  });

export const getDashboard = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => participant.parse(data))
  .handler(async ({ data }) => {
    const { loadDashboard } = await import("./assessment.server");
    return loadDashboard(data.participantId);
  });

export const getModuleResult = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    participant.extend({ moduleCode: z.string().min(2).max(10) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { loadModuleResult } = await import("./assessment.server");
    return loadModuleResult(data.participantId, data.moduleCode);
  });

export const getModule = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    participant.extend({ moduleCode: z.string().min(2).max(10) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { loadModule } = await import("./assessment.server");
    return loadModule(data.participantId, data.moduleCode);
  });

export const submitAnswer = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    participant
      .extend({ questionId: z.string().uuid(), value: z.number().int().min(1).max(5) })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { persistAnswer } = await import("./assessment.server");
    return persistAnswer(data.participantId, data.questionId, data.value);
  });

export const finalize = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => participant.parse(data))
  .handler(async ({ data }) => {
    const { finalizeSession } = await import("./assessment.server");
    return finalizeSession(data.participantId);
  });

export const getReport = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => participant.parse(data))
  .handler(async ({ data }) => {
    const { buildReport } = await import("./assessment.server");
    return buildReport(data.participantId);
  });
