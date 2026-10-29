// Server-only assessment logic using Prisma ORM.
import { Prisma } from "@prisma/client";
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

type ActiveAssessmentModule = {
  id: string;
  code: string;
  name: string;
  description: string;
  sequence: number;
  estimatedMinutes: number;
  isSensitive: boolean;
};

const activeModulesCache = new Map<string, { data: ActiveAssessmentModule[]; expiresAt: number }>();
const activeModulesInflight = new Map<string, Promise<ActiveAssessmentModule[]>>();

async function getActiveAssessmentModules(versionId: string) {
  const cached = activeModulesCache.get(versionId);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const inflight = activeModulesInflight.get(versionId);
  if (inflight) return inflight;

  const loading = prisma.assessmentModule
    .findMany({
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
    })
    .then((modules) => {
      activeModulesCache.set(versionId, { data: modules, expiresAt: Date.now() + 15 * 60 * 1000 });
      return modules;
    });

  activeModulesInflight.set(versionId, loading);
  try {
    return await loading;
  } finally {
    activeModulesInflight.delete(versionId);
  }
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
    getActiveAssessmentModules(versionId),
    prisma.moduleProgress.findMany({
      where: { sessionId: session.id },
      select: {
        id: true,
        moduleId: true,
        status: true,
        answeredCount: true,
        totalItems: true,
        startedAt: true,
        completedAt: true,
        sessionId: true,
      },
    }),
  ]);

  const missing = modules.filter((m) => !progress.some((p) => p.moduleId === m.id));
  if (missing.length > 0) {
    const questionCounts = await prisma.assessmentQuestion.groupBy({
      by: ["moduleId"],
      where: { moduleId: { in: missing.map((m) => m.id) }, active: true },
      _count: { _all: true },
    });
    const countByModule = new Map(questionCounts.map((row) => [row.moduleId, row._count._all]));
    const counts = missing.map((module) => ({
      moduleId: module.id,
      sessionId: session!.id,
      totalItems: countByModule.get(module.id) ?? 0,
    }));
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
  const session = await getCachedSession(userId);
  const catalog = await getModuleQuestionCatalog(session.versionId, moduleCode);

  const [answers, p] = await Promise.all([
    prisma.assessmentAnswer.findMany({
      where: { sessionId: session.id, moduleId: catalog.module.id },
      select: { questionId: true, answerValue: true },
    }),
    prisma.moduleProgress.findUnique({
      where: {
        sessionId_moduleId: { sessionId: session.id, moduleId: catalog.module.id },
      },
      select: { status: true, answeredCount: true, totalItems: true },
    }),
  ]);

  return {
    sessionId: session.id,
    module: {
      code: catalog.module.code,
      name: catalog.module.name,
      description: catalog.module.description,
      isSensitive: catalog.module.isSensitive,
    },
    questions: catalog.questions.map((q) => ({ id: q.id, code: q.itemCode, text: q.prompt })),
    answers: Object.fromEntries(answers.map((a) => [a.questionId, a.answerValue])),
    status: p?.status ?? "not_started",
  };
}

type ModuleQuestionCatalog = {
  module: {
    id: string;
    code: string;
    name: string;
    description: string;
    isSensitive: boolean;
  };
  questions: { id: string; itemCode: string; prompt: string; sequence: number }[];
};

const moduleQuestionCatalogCache = new Map<
  string,
  { data: ModuleQuestionCatalog; expiresAt: number }
>();
const moduleQuestionCatalogInflight = new Map<string, Promise<ModuleQuestionCatalog>>();

async function getModuleQuestionCatalog(
  versionId: string,
  moduleCode: string,
): Promise<ModuleQuestionCatalog> {
  const key = `${versionId}:${moduleCode}`;
  const cached = moduleQuestionCatalogCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const inflight = moduleQuestionCatalogInflight.get(key);
  if (inflight) return inflight;

  const loading = (async () => {
    const module = await prisma.assessmentModule.findFirst({
      where: { versionId, code: moduleCode },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isSensitive: true,
        questions: {
          where: { active: true },
          orderBy: { sequence: "asc" },
          select: { id: true, itemCode: true, prompt: true, sequence: true },
        },
      },
    });
    if (!module) throw new Error("Modul tidak ditemukan.");

    const data: ModuleQuestionCatalog = {
      module: {
        id: module.id,
        code: module.code,
        name: module.name,
        description: module.description,
        isSensitive: module.isSensitive,
      },
      questions: module.questions,
    };
    moduleQuestionCatalogCache.set(key, { data, expiresAt: Date.now() + 15 * 60 * 1000 });
    return data;
  })();

  moduleQuestionCatalogInflight.set(key, loading);
  try {
    return await loading;
  } finally {
    moduleQuestionCatalogInflight.delete(key);
  }
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

export type ModuleResultPayload = {
  module: {
    code: string;
    name: string;
    description: string;
    isSensitive: boolean;
  };
  result: {
    normalized: number;
    raw: number;
    category: string;
    interpretation: string;
  } | null;
  dimensions: {
    code: string;
    name: string;
    normalized: number;
    status: string;
  }[];
};

interface ModuleBlueprint {
  module: {
    id: string;
    code: string;
    name: string;
    description: string;
    isSensitive: boolean;
  };
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

  const [mod, dims, questions, bands] = await Promise.all([
    prisma.assessmentModule.findUnique({
      where: { id: moduleId },
      select: { id: true, code: true, name: true, description: true, isSensitive: true },
    }),
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

  if (!mod) throw new Error("Modul tidak ditemukan.");

  const parsedBands: Band[] = bands.map((b) => ({
    category: b.category,
    min_score: Number(b.minScore),
    max_score: Number(b.maxScore),
    interpretation: b.interpretation,
    sequence: b.sequence,
  }));

  const data = { module: mod, dims, questions, bands: parsedBands };
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

  if (entries.length > 0 || markCompleted) {
    const records = entries.map(([questionId, answerValue]) => {
      if (!Number.isInteger(answerValue) || answerValue < 1 || answerValue > 5) {
        throw new Error("Nilai jawaban tidak valid.");
      }
      const direction = questionMap.get(questionId) as "F" | "UF";
      return {
        questionId,
        answerValue,
        scoredValue: scoreAnswer(direction, answerValue),
      };
    });

    await prisma.$transaction(async (tx) => {
      const totalItems = questions.length;
      if (records.length > 0) {
        // A bulk upsert avoids delete/recreate churn and remains safe when
        // autosave requests overlap.
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO public.assessment_answers
            (session_id, module_id, question_id, answer_value, scored_value, answered_at)
          VALUES ${Prisma.join(
            records.map(
              (record) => Prisma.sql`(
                ${session.id}::uuid,
                ${mod.id}::uuid,
                ${record.questionId}::uuid,
                ${record.answerValue},
                ${record.scoredValue},
                CURRENT_TIMESTAMP
              )`,
            ),
          )}
          ON CONFLICT (session_id, question_id) DO UPDATE SET
            answer_value = EXCLUDED.answer_value,
            scored_value = EXCLUDED.scored_value,
            answered_at = EXCLUDED.answered_at
        `);
      }

      // Count answers and update progress in one database statement. This also
      // lets a completion request finalize progress when all answers were
      // already autosaved and there is no pending answer payload.
      await tx.$executeRaw(Prisma.sql`
        WITH answer_totals AS (
          SELECT COUNT(*)::int AS answered_count
          FROM public.assessment_answers
          WHERE session_id = ${session.id}::uuid AND module_id = ${mod.id}::uuid
        )
        UPDATE public.module_progress AS progress
        SET answered_count = answer_totals.answered_count,
            total_items = ${totalItems},
            status = CASE
              WHEN ${markCompleted} OR answer_totals.answered_count >= ${totalItems}
                THEN 'completed'
              ELSE 'in_progress'
            END,
            started_at = COALESCE(progress.started_at, CURRENT_TIMESTAMP),
            completed_at = CASE
              WHEN ${markCompleted} OR answer_totals.answered_count >= ${totalItems}
                THEN COALESCE(progress.completed_at, CURRENT_TIMESTAMP)
              ELSE NULL
            END
        FROM answer_totals
        WHERE progress.session_id = ${session.id}::uuid
          AND progress.module_id = ${mod.id}::uuid
      `);
    });
  }

  let moduleResult: ModuleResultPayload | null = null;
  const isCompleted = markCompleted || entries.length >= questions.length;
  if (isCompleted) {
    moduleResult = await scoreModule(session.id, mod.id);
  }

  return { saved: true, count: entries.length, completed: isCompleted, result: moduleResult };
}

async function scoreModule(sessionId: string, moduleId: string): Promise<ModuleResultPayload> {
  const [blueprint, answers] = await Promise.all([
    getModuleBlueprint(moduleId),
    prisma.assessmentAnswer.findMany({
      where: { sessionId, moduleId },
      select: { questionId: true, scoredValue: true },
    }),
  ]);

  const { module: modMeta, dims, questions, bands: parsedBands } = blueprint;
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

  return {
    module: {
      code: modMeta.code,
      name: modMeta.name,
      description: modMeta.description,
      isSensitive: modMeta.isSensitive,
    },
    result: {
      normalized: Math.round(Number(moduleNorm)),
      raw: Number(totalRaw),
      category: band?.category ?? "Tidak Terkategori",
      interpretation: band?.interpretation ?? "",
    },
    dimensions: dims.map((d) => {
      const dr = dimRows.find((x) => x.dimensionId === d.id);
      return {
        code: d.code,
        name: d.name,
        normalized: dr ? Math.round(Number(dr.normalizedScore)) : 0,
        status: dr?.status ?? "-",
      };
    }),
  };
}

export async function finalizeSession(userId: string) {
  const session = await requireOwnSession(userId);

  // A completed assessment is immutable from the learner flow. Avoid scoring
  // and rebuilding the report again when the processing page is revisited.
  if (session.status === "completed" && session.scoringCalculated) {
    const existingOverall = await prisma.overallResult.findFirst({
      where: { sessionId: session.id },
      select: { readinessScore: true },
    });
    return {
      ready: true as const,
      readiness: existingOverall ? Number(existingOverall.readinessScore) : 0,
    };
  }

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

  await buildReport(userId, true, session);

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

export async function buildReport(
  userId: string,
  forceFresh = false,
  existingSession?: Awaited<ReturnType<typeof requireOwnSession>>,
): Promise<AssessmentReport> {
  const session = existingSession ?? (await requireOwnSession(userId));

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

export async function loadModuleResult(userId: string, moduleCode: string): Promise<ModuleResultPayload> {
  const session = await getCachedSession(userId);
  const catalog = await getModuleQuestionCatalog(session.versionId, moduleCode);

  const [dims, result, dimResults] = await Promise.all([
    prisma.assessmentDimension.findMany({
      where: { moduleId: catalog.module.id },
      orderBy: { sequence: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.assessmentResult.findFirst({
      where: { sessionId: session.id, moduleId: catalog.module.id },
      select: { normalizedScore: true, rawScore: true, category: true, interpretation: true },
    }),
    prisma.dimensionResult.findMany({
      where: { sessionId: session.id, moduleId: catalog.module.id },
      select: { dimensionId: true, normalizedScore: true, status: true },
    }),
  ]);

  return {
    module: {
      code: catalog.module.code,
      name: catalog.module.name,
      description: catalog.module.description,
      isSensitive: catalog.module.isSensitive,
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
