// Server-only assessment logic using Prisma ORM.
import { prisma } from "./prisma";
import {
  matchBandByRaw,
  matchBandByScore,
  normalize,
  scoreAnswer,
  dimensionStatus,
  type Band,
} from "./scoring";

let cachedPublishedVersionId: { id: string; expiresAt: number } | null = null;

async function publishedVersionId(): Promise<string> {
  if (cachedPublishedVersionId && cachedPublishedVersionId.expiresAt > Date.now()) {
    return cachedPublishedVersionId.id;
  }
  const data = await prisma.contentVersion.findFirst({
    where: { status: "published" },
    orderBy: { publishedAt: "desc" },
    select: { id: true },
  });
  if (!data) throw new Error("Belum ada versi konten yang dipublikasikan.");
  cachedPublishedVersionId = { id: data.id, expiresAt: Date.now() + 10 * 60 * 1000 };
  return data.id;
}

export async function ensureProfile(userId: string, email?: string, fullName?: string) {
  const existing = await prisma.profile.findUnique({
    where: { id: userId },
  });
  if (existing) return existing;
  return await prisma.profile.create({
    data: {
      id: userId,
      email: email ?? null,
      fullName: fullName ?? "",
    },
  });
}

export async function ensureSession(userId: string) {
  const versionId = await publishedVersionId();
  let session = await prisma.assessmentSession.findFirst({
    where: { userId, versionId },
    orderBy: { startedAt: "desc" },
  });

  if (!session) {
    session = await prisma.assessmentSession.create({
      data: { userId, versionId },
    });
  }
  if (!session) throw new Error("Gagal membuat sesi asesmen.");

  const [modules, progress] = await Promise.all([
    prisma.assessmentModule.findMany({
      where: { versionId, active: true },
      orderBy: { sequence: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        sequence: true,
        estimatedMinutes: true,
        isSensitive: true,
      },
    }),
    prisma.moduleProgress.findMany({
      where: { sessionId: session.id },
    }),
  ]);

  const missing = modules.filter((m) => !progress.some((p) => p.moduleId === m.id));
  if (missing.length > 0) {
    const counts = await Promise.all(
      missing.map(async (m) => {
        const count = await prisma.assessmentQuestion.count({
          where: { moduleId: m.id, active: true },
        });
        return {
          moduleId: m.id,
          sessionId: session!.id,
          totalItems: count,
        };
      }),
    );
    await prisma.moduleProgress.createMany({ data: counts });
    counts.forEach((c) => {
      progress.push({
        id: "",
        sessionId: c.sessionId,
        moduleId: c.moduleId,
        status: "not_started",
        answeredCount: 0,
        totalItems: c.totalItems,
        startedAt: null,
        completedAt: null,
      });
    });
  }

  // Self-heal totalItems if session was created before question bank was seeded
  const needsSync = progress.filter((p) => p.totalItems === 0);
  if (needsSync.length > 0) {
    await Promise.all(
      needsSync.map(async (p) => {
        const count = await prisma.assessmentQuestion.count({
          where: { moduleId: p.moduleId, active: true },
        });
        if (count > 0) {
          p.totalItems = count;
          await prisma.moduleProgress.update({
            where: { id: p.id },
            data: { totalItems: count },
          });
        }
      }),
    );
  }

  return { session, versionId, modules, progress };
}

export async function loadDashboard(userId: string, email?: string, fullName?: string) {
  const [profile, { session, modules, progress }] = await Promise.all([
    ensureProfile(userId, email, fullName),
    ensureSession(userId),
  ]);

  const moduleResults = await prisma.assessmentResult.findMany({
    where: { sessionId: session.id },
    select: { moduleId: true, normalizedScore: true, category: true },
  });

  const items = modules.map((m) => {
    const p = progress.find((x) => x.moduleId === m.id);
    const r = moduleResults.find((x) => x.moduleId === m.id);
    return {
      code: m.code,
      name: m.name,
      description: m.description,
      estimatedMinutes: m.estimatedMinutes,
      isSensitive: m.isSensitive,
      total: p?.totalItems ?? 0,
      answered: p?.answeredCount ?? 0,
      status: p?.status ?? "not_started",
      score: r ? Math.round(Number(r.normalizedScore)) : null,
      category: r?.category ?? null,
    };
  });

  const allCompleted = items.length > 0 && items.every((i) => i.status === "completed");
  return {
    profile: {
      fullName: profile.fullName,
      email: profile.email,
      consentAt: profile.consentAt,
      targetInstitution: profile.targetInstitution,
      targetProgram: profile.targetProgram,
    },
    sessionId: session.id,
    sessionStatus: session.status,
    scoringCalculated: session.scoringCalculated,
    modules: items,
    allCompleted,
  };
}

export async function saveProfileData(
  userId: string,
  email: string | undefined,
  input: Record<string, unknown>,
) {
  await ensureProfile(userId, email);
  await prisma.profile.update({
    where: { id: userId },
    data: mapProfileInput(input) as never,
  });
  return { ok: true };
}

async function requireOwnSession(userId: string) {
  const session = await prisma.assessmentSession.findFirst({
    where: { userId },
    orderBy: { startedAt: "desc" },
  });
  if (session) return session;

  const { session: newSession } = await ensureSession(userId);
  return newSession;
}

export async function loadModule(userId: string, moduleCode: string) {
  const session = await requireOwnSession(userId);
  const mod = await prisma.assessmentModule.findFirst({
    where: { versionId: session.versionId, code: moduleCode },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      isSensitive: true,
      estimatedMinutes: true,
    },
  });
  if (!mod) throw new Error("Modul tidak ditemukan.");

  const [questions, answers, p] = await Promise.all([
    prisma.assessmentQuestion.findMany({
      where: { moduleId: mod.id, active: true },
      orderBy: { sequence: "asc" },
      select: { id: true, itemCode: true, prompt: true, sequence: true },
    }),
    prisma.assessmentAnswer.findMany({
      where: { sessionId: session.id, moduleId: mod.id },
      select: { questionId: true, answerValue: true },
    }),
    prisma.moduleProgress.findUnique({
      where: { sessionId_moduleId: { sessionId: session.id, moduleId: mod.id } },
      select: { status: true, answeredCount: true, totalItems: true },
    }),
  ]);

  return {
    sessionId: session.id,
    module: {
      code: mod.code,
      name: mod.name,
      description: mod.description,
      isSensitive: mod.isSensitive,
    },
    questions: questions.map((q) => ({ id: q.id, code: q.itemCode, text: q.prompt })),
    answers: Object.fromEntries(answers.map((a) => [a.questionId, a.answerValue])),
    status: p?.status ?? "not_started",
  };
}

// In-memory caches to eliminate unnecessary roundtrips
const questionMetaCache = new Map<
  string,
  { id: string; moduleId: string; dimensionId: string; direction: string }
>();

interface CachedSession {
  session: Awaited<ReturnType<typeof requireOwnSession>>;
  expiresAt: number;
}
const userSessionCache = new Map<string, CachedSession>();

async function getCachedSession(userId: string) {
  const cached = userSessionCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.session;
  }
  const session = await requireOwnSession(userId);
  userSessionCache.set(userId, { session, expiresAt: Date.now() + 5 * 60 * 1000 });
  return session;
}

export async function persistAnswer(userId: string, questionId: string, answerValue: number) {
  if (!Number.isInteger(answerValue) || answerValue < 1 || answerValue > 5) {
    throw new Error("Nilai jawaban tidak valid.");
  }
  const session = await getCachedSession(userId);

  let q = questionMetaCache.get(questionId);
  if (!q) {
    const dbQ = await prisma.assessmentQuestion.findUnique({
      where: { id: questionId },
      select: { id: true, moduleId: true, dimensionId: true, direction: true },
    });
    if (!dbQ) throw new Error("Item tidak ditemukan.");
    q = dbQ;
    questionMetaCache.set(questionId, q);
  }

  const scored = scoreAnswer(q.direction as "F" | "UF", answerValue);

  // Batch upsert and progress check together in a single transaction
  const [, answeredCount, progress] = await prisma.$transaction([
    prisma.assessmentAnswer.upsert({
      where: {
        sessionId_questionId: {
          sessionId: session.id,
          questionId: questionId,
        },
      },
      create: {
        sessionId: session.id,
        questionId: questionId,
        moduleId: q.moduleId,
        answerValue,
        scoredValue: scored,
      },
      update: {
        answerValue,
        scoredValue: scored,
        answeredAt: new Date(),
      },
    }),
    prisma.assessmentAnswer.count({
      where: { sessionId: session.id, moduleId: q.moduleId },
    }),
    prisma.moduleProgress.findUnique({
      where: {
        sessionId_moduleId: {
          sessionId: session.id,
          moduleId: q.moduleId,
        },
      },
      select: { totalItems: true },
    }),
  ]);

  let totalItems = progress?.totalItems ?? 0;
  if (totalItems === 0) {
    totalItems = await prisma.assessmentQuestion.count({
      where: { moduleId: q.moduleId, active: true },
    });
  }
  const moduleCompleted = totalItems > 0 && answeredCount >= totalItems;

  await prisma.moduleProgress.update({
    where: {
      sessionId_moduleId: {
        sessionId: session.id,
        moduleId: q.moduleId,
      },
    },
    data: {
      answeredCount,
      status: moduleCompleted ? "completed" : "in_progress",
      startedAt: new Date(),
      completedAt: moduleCompleted ? new Date() : null,
    },
  });

  if (moduleCompleted) {
    await scoreModule(session.id, q.moduleId);
  }

  return { saved: true, answeredCount, totalItems, moduleCompleted };
}

interface ModuleBlueprint {
  questions: { id: string; dimensionId: string; direction: string }[];
  dims: { id: string; code: string; name: string; sequence: number }[];
  bands: Band[];
}

const moduleBlueprintCache = new Map<string, { data: ModuleBlueprint; expiresAt: number }>();

async function getModuleBlueprint(moduleId: string): Promise<ModuleBlueprint> {
  const cached = moduleBlueprintCache.get(moduleId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const [dims, questions, bands] = await Promise.all([
    prisma.assessmentDimension.findMany({
      where: { moduleId },
      orderBy: { sequence: "asc" },
      select: { id: true, code: true, name: true, sequence: true },
    }),
    prisma.assessmentQuestion.findMany({
      where: { moduleId, active: true },
      select: { id: true, dimensionId: true, direction: true },
    }),
    prisma.interpretationBand.findMany({
      where: { moduleId, scope: "module" },
      orderBy: { sequence: "asc" },
      select: {
        category: true,
        minScore: true,
        maxScore: true,
        interpretation: true,
        sequence: true,
      },
    }),
  ]);

  const parsedBands: Band[] = bands.map((b) => ({
    category: b.category,
    min_score: Number(b.minScore),
    max_score: Number(b.maxScore),
    interpretation: b.interpretation,
    sequence: b.sequence,
  }));

  const data = { dims, questions, bands: parsedBands };
  moduleBlueprintCache.set(moduleId, { data, expiresAt: Date.now() + 15 * 60 * 1000 });
  return data;
}

let cachedOverallBands: { bands: Band[]; expiresAt: number } | null = null;

async function getOverallBands(): Promise<Band[]> {
  if (cachedOverallBands && cachedOverallBands.expiresAt > Date.now()) {
    return cachedOverallBands.bands;
  }
  const bands = await prisma.interpretationBand.findMany({
    where: { scope: "overall" },
    orderBy: { sequence: "asc" },
    select: {
      category: true,
      minScore: true,
      maxScore: true,
      interpretation: true,
      sequence: true,
    },
  });
  const parsed = bands.map((b) => ({
    category: b.category,
    min_score: Number(b.minScore),
    max_score: Number(b.maxScore),
    interpretation: b.interpretation,
    sequence: b.sequence,
  }));
  cachedOverallBands = { bands: parsed, expiresAt: Date.now() + 15 * 60 * 1000 };
  return parsed;
}

export async function persistBatchAnswers(
  userId: string,
  moduleCode: string,
  answers: Record<string, number>,
  markCompleted = false,
) {
  const session = await getCachedSession(userId);

  const mod = await prisma.assessmentModule.findFirst({
    where: { versionId: session.versionId, code: moduleCode },
    select: { id: true, code: true },
  });
  if (!mod) throw new Error("Modul tidak ditemukan.");

  const { questions } = await getModuleBlueprint(mod.id);
  const questionMap = new Map(questions.map((q) => [q.id, q.direction]));
  const entries = Object.entries(answers).filter(([qid]) => questionMap.has(qid));

  if (entries.length > 0) {
    await prisma.$transaction(async (tx) => {
      const qids = entries.map(([qid]) => qid);
      await tx.assessmentAnswer.deleteMany({
        where: {
          sessionId: session.id,
          questionId: { in: qids },
        },
      });

      const records = entries.map(([qid, val]) => {
        const dir = (questionMap.get(qid) as "F" | "UF") || "F";
        const scored = scoreAnswer(dir, val);
        return {
          sessionId: session.id,
          moduleId: mod.id,
          questionId: qid,
          answerValue: val,
          scoredValue: scored,
        };
      });

      await tx.assessmentAnswer.createMany({
        data: records,
      });

      const answeredCount = await tx.assessmentAnswer.count({
        where: { sessionId: session.id, moduleId: mod.id },
      });

      const existingProgress = await tx.moduleProgress.findUnique({
        where: { sessionId_moduleId: { sessionId: session.id, moduleId: mod.id } },
        select: { status: true, answeredCount: true, completedAt: true },
      });

      const totalItems = questions.length;
      const wasCompleted = existingProgress?.status === "completed";
      const isComplete = markCompleted || wasCompleted || (totalItems > 0 && answeredCount >= totalItems);

      await tx.moduleProgress.update({
        where: { sessionId_moduleId: { sessionId: session.id, moduleId: mod.id } },
        data: {
          answeredCount: Math.max(answeredCount, existingProgress?.answeredCount ?? 0),
          totalItems,
          status: isComplete ? "completed" : "in_progress",
          startedAt: new Date(),
          completedAt: isComplete ? (existingProgress?.completedAt ?? new Date()) : null,
        },
      });
    });
  }

  const isCompleted = markCompleted || entries.length >= questions.length;
  if (isCompleted) {
    await scoreModule(session.id, mod.id);
  }

  return { saved: true, count: entries.length, completed: isCompleted };
}

async function scoreModule(sessionId: string, moduleId: string) {
  const [blueprint, answers] = await Promise.all([
    getModuleBlueprint(moduleId),
    prisma.assessmentAnswer.findMany({
      where: { sessionId, moduleId },
      select: { questionId: true, scoredValue: true },
    }),
  ]);

  const { dims, questions, bands: parsedBands } = blueprint;
  const scoreByQuestion = new Map(answers.map((a) => [a.questionId, a.scoredValue]));

  const dimRows = dims.map((d) => {
    const qs = questions.filter((q) => q.dimensionId === d.id);
    const raw = qs.reduce((sum, q) => sum + (scoreByQuestion.get(q.id) ?? 0), 0);
    const norm = normalize(raw, qs.length);
    return {
      sessionId,
      moduleId,
      dimensionId: d.id,
      rawScore: raw,
      normalizedScore: norm,
      status: dimensionStatus(norm),
    };
  });

  const totalRaw = answers.reduce((s, a) => s + a.scoredValue, 0);
  const itemCount = questions.length;
  const moduleNorm = normalize(totalRaw, itemCount);

  const band = matchBandByRaw(parsedBands, totalRaw, itemCount);
  const scored = dimRows.filter((d) => d.rawScore > 0 || d.normalizedScore > 0);
  const sortedDims = [...scored].sort((a, b) => b.normalizedScore - a.normalizedScore);

  await prisma.$transaction([
    prisma.dimensionResult.deleteMany({
      where: { sessionId, moduleId },
    }),
    ...(dimRows.length > 0
      ? [
          prisma.dimensionResult.createMany({
            data: dimRows,
          }),
        ]
      : []),
    prisma.assessmentResult.deleteMany({
      where: { sessionId, moduleId },
    }),
    prisma.assessmentResult.create({
      data: {
        sessionId,
        moduleId,
        rawScore: totalRaw,
        normalizedScore: moduleNorm,
        category: band?.category ?? "Tidak Terkategori",
        interpretation: band?.interpretation ?? "",
        strongestDimensionId: sortedDims[0]?.dimensionId ?? null,
        weakestDimensionId: sortedDims[sortedDims.length - 1]?.dimensionId ?? null,
      },
    }),
  ]);
}

export async function finalizeSession(userId: string) {
  const session = await requireOwnSession(userId);

  const [progress, results, parsedBands] = await Promise.all([
    prisma.moduleProgress.findMany({
      where: { sessionId: session.id },
      select: { status: true },
    }),
    prisma.assessmentResult.findMany({
      where: { sessionId: session.id },
      select: { normalizedScore: true },
    }),
    getOverallBands(),
  ]);

  const complete = progress.length > 0 && progress.every((p) => p.status === "completed");
  if (!complete) return { ready: false as const };

  const readiness =
    results.length > 0
      ? Math.round(
          (results.reduce((s, r) => s + Number(r.normalizedScore), 0) / results.length) * 10,
        ) / 10
      : 0;

  const band = matchBandByScore(parsedBands, readiness);

  await prisma.$transaction([
    prisma.overallResult.deleteMany({
      where: { sessionId: session.id },
    }),
    prisma.overallResult.create({
      data: {
        sessionId: session.id,
        readinessScore: readiness,
        category: band?.category ?? "Tidak Terkategori",
        interpretation: band?.interpretation ?? "",
      },
    }),
    prisma.assessmentSession.update({
      where: { id: session.id },
      data: {
        status: "completed",
        scoringCalculated: true,
        completedAt: new Date(),
      },
    }),
  ]);

  const report = await buildReport(userId, true);
  await prisma.reportSnapshot.upsert({
    where: { sessionId: session.id },
    create: {
      sessionId: session.id,
      payload: report as never,
    },
    update: {
      payload: report as never,
    },
  });

  return { ready: true as const, readiness };
}

export type AssessmentReport = {
  assessmentId: string;
  generatedAt: string;
  participant: {
    fullName: string;
    email: string | null;
    targetInstitution: string | null;
    targetProgram: string | null;
    city: string | null;
    code: string | null;
  };
  overall: {
    readiness: number;
    category: string;
    interpretation: string;
  } | null;
  modules: {
    code: string;
    name: string;
    isSensitive: boolean;
    normalized: number;
    raw: number;
    category: string;
    interpretation: string;
    dimensions: {
      code: string;
      name: string;
      normalized: number;
      status: string;
    }[];
    recommendations: {
      moduleId: string | null;
      category: string | null;
      title: string;
      body: string;
      priority: number;
    }[];
  }[];
  strengths: {
    moduleName: string;
    moduleCode: string;
    code: string;
    name: string;
    normalized: number;
    status: string;
  }[];
  developmentAreas: {
    moduleName: string;
    moduleCode: string;
    code: string;
    name: string;
    normalized: number;
    status: string;
  }[];
  supportContacts: {
    label: string;
    description: string;
    phone: string | null;
    url: string | null;
  }[];
};

export async function buildReport(userId: string, forceFresh = false): Promise<AssessmentReport> {
  const session = await requireOwnSession(userId);

  if (!forceFresh) {
    const snapshot = await prisma.reportSnapshot.findUnique({
      where: { sessionId: session.id },
    });
    if (snapshot?.payload) {
      return snapshot.payload as unknown as AssessmentReport;
    }
  }

  const [profile, overall, modules, results, dimResults, contacts] = await Promise.all([
    ensureProfile(userId),
    prisma.overallResult.findFirst({
      where: { sessionId: session.id },
    }),
    prisma.assessmentModule.findMany({
      where: { versionId: session.versionId },
      orderBy: { sequence: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        sequence: true,
        isSensitive: true,
      },
    }),
    prisma.assessmentResult.findMany({
      where: { sessionId: session.id },
    }),
    prisma.dimensionResult.findMany({
      where: { sessionId: session.id },
    }),
    prisma.supportContact.findMany({
      where: { active: true },
      orderBy: { sequence: "asc" },
      select: { label: true, description: true, phone: true, url: true },
    }),
  ]);

  const moduleIds = modules.map((m) => m.id);
  const [dims, recommendations] = await Promise.all([
    prisma.assessmentDimension.findMany({
      where: { moduleId: { in: moduleIds } },
      orderBy: { sequence: "asc" },
      select: { id: true, moduleId: true, code: true, name: true, sequence: true },
    }),
    prisma.recommendation.findMany({
      where: { active: true, moduleId: { in: moduleIds } },
      orderBy: { priority: "asc" },
      select: { moduleId: true, category: true, title: true, body: true, priority: true },
    }),
  ]);

  const moduleReports = modules.map((m) => {
    const r = results.find((x) => x.moduleId === m.id);
    const ds = dimResults
      .filter((x) => x.moduleId === m.id)
      .map((x) => {
        const d = dims.find((y) => y.id === x.dimensionId);
        return {
          code: d?.code ?? "",
          name: d?.name ?? "",
          normalized: Number(x.normalizedScore),
          status: x.status,
        };
      })
      .sort((a, b) => b.normalized - a.normalized);
    return {
      code: m.code,
      name: m.name,
      isSensitive: m.isSensitive,
      normalized: r ? Number(r.normalizedScore) : 0,
      raw: r ? Number(r.rawScore) : 0,
      category: r?.category ?? "-",
      interpretation: r?.interpretation ?? "",
      dimensions: ds,
      recommendations: recommendations.filter(
        (rec) => rec.moduleId === m.id && (!rec.category || rec.category === r?.category),
      ),
    };
  });

  const allDims = moduleReports.flatMap((m) =>
    m.dimensions.map((d) => ({ ...d, moduleName: m.name, moduleCode: m.code })),
  );

  const reportPayload = {
    assessmentId: session.id,
    generatedAt: new Date().toISOString(),
    participant: {
      fullName: profile.fullName,
      email: profile.email,
      targetInstitution: profile.targetInstitution,
      targetProgram: profile.targetProgram,
      city: profile.city,
      code: profile.code,
    },
    overall: overall
      ? {
          readiness: Number(overall.readinessScore),
          category: overall.category,
          interpretation: overall.interpretation,
        }
      : null,
    modules: moduleReports,
    strengths: [...allDims].sort((a, b) => b.normalized - a.normalized).slice(0, 3),
    developmentAreas: [...allDims].sort((a, b) => a.normalized - b.normalized).slice(0, 3),
    supportContacts: contacts.length > 0 ? contacts : [],
  };

  if (overall) {
    try {
      await prisma.reportSnapshot.upsert({
        where: { sessionId: session.id },
        create: { sessionId: session.id, payload: reportPayload as never },
        update: { payload: reportPayload as never },
      });
    } catch {
      // ignore concurrent snapshot update
    }
  }

  return reportPayload as AssessmentReport;
}

export async function loadModuleResult(userId: string, moduleCode: string) {
  const session = await requireOwnSession(userId);
  const mod = await prisma.assessmentModule.findFirst({
    where: { versionId: session.versionId, code: moduleCode },
    select: { id: true, code: true, name: true, description: true, isSensitive: true },
  });
  if (!mod) throw new Error("Modul tidak ditemukan.");

  const [result, dims, dimResults] = await Promise.all([
    prisma.assessmentResult.findFirst({
      where: { sessionId: session.id, moduleId: mod.id },
      select: { normalizedScore: true, rawScore: true, category: true, interpretation: true },
    }),
    prisma.assessmentDimension.findMany({
      where: { moduleId: mod.id },
      orderBy: { sequence: "asc" },
      select: { id: true, code: true, name: true, sequence: true },
    }),
    prisma.dimensionResult.findMany({
      where: { sessionId: session.id, moduleId: mod.id },
      select: { dimensionId: true, normalizedScore: true, status: true },
    }),
  ]);

  return {
    module: {
      code: mod.code,
      name: mod.name,
      description: mod.description,
      isSensitive: mod.isSensitive,
    },
    result: result
      ? {
          normalized: Math.round(Number(result.normalizedScore)),
          raw: Number(result.rawScore),
          category: result.category,
          interpretation: result.interpretation,
        }
      : null,
    dimensions: dims.map((d) => {
      const dr = dimResults.find((x) => x.dimensionId === d.id);
      return {
        code: d.code,
        name: d.name,
        normalized: dr ? Math.round(Number(dr.normalizedScore)) : 0,
        status: dr?.status ?? "-",
      };
    }),
  };
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode() {
  let s = "";
  for (let i = 0; i < 4; i += 1) {
    s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `TFS-${s}`;
}

function normalizePhone(v: string) {
  return v.replace(/[^0-9]/g, "").replace(/^0/, "62");
}

function mapProfileInput(input: Record<string, unknown>) {
  const output: Record<string, unknown> = {};
  if ("full_name" in input) output["fullName"] = input["full_name"];
  if ("gender" in input) output["gender"] = input["gender"];
  if ("class_level" in input) output["classLevel"] = input["class_level"];
  if ("school_name" in input) output["schoolName"] = input["school_name"];
  if ("major" in input) output["major"] = input["major"];
  if ("city" in input) output["city"] = input["city"];
  if ("whatsapp" in input) output["whatsapp"] = input["whatsapp"];
  if ("email" in input) output["email"] = input["email"];
  if ("birth_place" in input) output["birthPlace"] = input["birth_place"];
  if ("birth_date" in input) {
    output["birthDate"] = input["birth_date"] ? new Date(String(input["birth_date"])) : null;
  }
  if ("height_cm" in input) output["heightCm"] = input["height_cm"];
  if ("weight_kg" in input) output["weightKg"] = input["weight_kg"];
  if ("guardian_name" in input) output["guardianName"] = input["guardian_name"];
  if ("guardian_whatsapp" in input) output["guardianWhatsapp"] = input["guardian_whatsapp"];
  if ("target_institution" in input) output["targetInstitution"] = input["target_institution"];
  if ("career_target" in input) output["careerTarget"] = input["career_target"];
  if ("referral_source" in input) output["referralSource"] = input["referral_source"];
  if ("consent_version" in input) output["consentVersion"] = input["consent_version"];
  if ("consent_at" in input) {
    output["consentAt"] = input["consent_at"] ? new Date(String(input["consent_at"])) : null;
  }
  return output;
}

export async function registerParticipant(input: Record<string, unknown>) {
  const mapped = mapProfileInput(input);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = randomCode();
    try {
      const data = await prisma.profile.create({
        data: {
          ...mapped,
          code,
        },
        select: { id: true, code: true },
      });
      return { participantId: data.id, code: data.code ?? code };
    } catch (err: unknown) {
      if (
        err != null &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        continue;
      }
      throw err;
    }
  }
  throw new Error("Gagal membuat kode peserta. Coba lagi.");
}

export async function updateParticipant(participantId: string, input: Record<string, unknown>) {
  const mapped = mapProfileInput(input);
  await prisma.profile.update({
    where: { id: participantId },
    data: mapped,
  });
  return { ok: true };
}

export async function findParticipant(input: {
  code?: string | null | undefined;
  whatsapp?: string | null | undefined;
  birthDate?: string | null | undefined;
}) {
  if (input.code) {
    const code = input.code.trim().toUpperCase();
    const normalized = code.startsWith("TFS-") ? code : `TFS-${code}`;
    const data = await prisma.profile.findUnique({
      where: { code: normalized },
      select: { id: true, code: true, fullName: true },
    });
    if (!data) return null;
    return { participantId: data.id, code: data.code, fullName: data.fullName };
  }
  if (input.whatsapp && input.birthDate) {
    const target = normalizePhone(input.whatsapp);
    const birthDateObj = new Date(input.birthDate);
    const data = await prisma.profile.findMany({
      where: { birthDate: birthDateObj },
      orderBy: { createdAt: "desc" },
      select: { id: true, code: true, fullName: true, whatsapp: true },
    });
    const match = data.find((row) => row.whatsapp && normalizePhone(row.whatsapp) === target);
    if (!match) return null;
    return { participantId: match.id, code: match.code, fullName: match.fullName };
  }
  return null;
}
