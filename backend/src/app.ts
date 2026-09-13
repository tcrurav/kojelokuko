import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { UniqueConstraintError } from "sequelize";
import { db, Teacher, Player, Game } from "./db";
import { AppError, requireThat } from "./domain";
import {
  requireActiveAccount,
  requireAdministrator,
  listTeachers,
  changeTeacher,
} from "./administration";
import { createGame, join, hash, Identity, snapshot } from "./services";
import {
  createQuestion,
  setQuestionActive,
  questionActivationSchema,
  updateQuestion,
  deleteQuestion,
  getQuestion,
  listQuestions,
  questionSchema,
  questionUpdateSchema,
  questionVersionSchema,
  questionQuerySchema,
} from "./questions";
export const avatars = [
  "🤖",
  "🥷",
  "🚀",
  "🦖",
  "👽",
  "🐙",
  "🐱",
  "💻",
  "🧙",
  "🧪",
  "🛡️",
  "👻",
] as const;
const secret = () => {
  const value = process.env.JWT_SECRET;
  requireThat(
    value && value.length >= 32,
    "JWT_SECRET must contain at least 32 characters",
    500,
  );
  return value;
};
export async function authenticate(
  token: string,
  kind: string,
): Promise<Identity> {
  if (kind === "player") {
    const p = await Player.findOne({
      where: { sessionTokenHash: hash(token) },
    });
    requireThat(p, "unauthorized", 401);
    return { kind: "player", id: p.id };
  }
  try {
    const payload = jwt.verify(token, secret(), { algorithms: ["HS256"] });
    requireThat(
      typeof payload !== "string" &&
        payload.kind === "teacher" &&
        typeof payload.sub === "string",
      "unauthorized",
      401,
    );
    const account = requireActiveAccount(
      await Teacher.findByPk(Number(payload.sub)),
    );
    requireThat(
      (payload.sessionVersion ?? 0) === account.sessionVersion,
      "unauthorized",
      401,
    );
    return { kind: "teacher", id: Number(payload.sub) };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("unauthorized", 401);
  }
}
export function errorPayload(error: unknown) {
  if (error instanceof AppError)
    return { status: error.status, error: error.code };
  if (error instanceof z.ZodError)
    return { status: 400, error: "invalid_input" };
  if (error instanceof UniqueConstraintError)
    return { status: 409, error: "already_exists" };
  console.error(
    "request_failed",
    error instanceof Error ? error.name : "unknown",
  );
  return { status: 500, error: "internal_error" };
}
const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    void fn(req, res).catch(next);
  };
const credentials = z.object({
  email: z
    .string()
    .email()
    .max(120)
    .transform((s) => s.toLowerCase()),
  password: z
    .string()
    .min(10)
    .max(72)
    .refine((s) => Buffer.byteLength(s) <= 72),
});
export const app = express();
app.set("trust proxy", process.env.NODE_ENV === "production" ? 1 : false);
app.use(helmet());
app.use(express.json({ limit: "16kb" }));
app.get(
  "/api/health",
  wrap(async (_req, res) => {
    try {
      await db.authenticate();
      res.json({ status: "ok", database: "ok" });
    } catch {
      res.status(503).json({ status: "error", database: "unavailable" });
    }
  }),
);
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 40 }));
app.post(
  "/api/auth/register",
  wrap(async (req, res) => {
    const data = credentials
      .extend({ name: z.string().trim().min(1).max(60) })
      .strict()
      .parse(req.body);
    const teacher = await Teacher.create({
      name: data.name,
      email: data.email,
      passwordHash: await bcrypt.hash(data.password, 12),
    });
    res.status(201).json({ name: teacher.name, pendingActivation: true });
  }),
);
app.post(
  "/api/auth/login",
  wrap(async (req, res) => {
    const data = credentials.parse(req.body);
    const teacher = await Teacher.findOne({ where: { email: data.email } });
    requireThat(
      teacher &&
        !teacher.deletedAt &&
        (await bcrypt.compare(data.password, teacher.passwordHash)),
      "invalid_credentials",
      401,
    );
    requireActiveAccount(teacher);
    res.json({
      token: jwt.sign(
        { kind: "teacher", sessionVersion: teacher.sessionVersion },
        secret(),
        {
          subject: String(teacher.id),
          expiresIn: 28800,
        },
      ),
      name: teacher.name,
      role: teacher.role,
    });
  }),
);
const identity = (req: Request) =>
  authenticate(
    (req.headers.authorization || "").replace(/^Bearer /, ""),
    String(req.headers["x-session-kind"] || "teacher"),
  );
const teacherOnly = async (req: Request) => {
  const who = await identity(req);
  requireThat(who.kind === "teacher", "forbidden", 403);
  return who;
};
const questionId = (req: Request) =>
  z.coerce.number().int().positive().parse(req.params.id);
app.get(
  "/api/admin/teachers",
  wrap(async (req, res) => {
    const who = await teacherOnly(req);
    const query = z
      .object({
        search: z.string().trim().max(120).default(""),
        page: z.coerce.number().int().min(1).max(100000).default(1),
      })
      .parse(req.query);
    res.json(await listTeachers(who.id, query.search, query.page));
  }),
);
app.put(
  "/api/admin/teachers/:id",
  wrap(async (req, res) => {
    const who = await teacherOnly(req);
    await requireAdministrator(who.id);
    const data = z.object({ isActive: z.boolean() }).strict().parse(req.body);
    await changeTeacher(who.id, questionId(req), data.isActive);
    res.json({ ok: true });
  }),
);
app.delete(
  "/api/admin/teachers/:id",
  wrap(async (req, res) => {
    const who = await teacherOnly(req);
    await changeTeacher(who.id, questionId(req), null);
    res.json({ ok: true });
  }),
);
app.get(
  "/api/questions",
  wrap(async (req, res) => {
    await teacherOnly(req);
    const query = questionQuerySchema.parse(req.query);
    res.json(await listQuestions(query.search, query.page));
  }),
);
app.get(
  "/api/questions/:id",
  wrap(async (req, res) => {
    await teacherOnly(req);
    res.json(await getQuestion(questionId(req)));
  }),
);
app.post(
  "/api/questions",
  wrap(async (req, res) => {
    await teacherOnly(req);
    res.status(201).json(await createQuestion(questionSchema.parse(req.body)));
  }),
);
app.put(
  "/api/questions/:id/activation",
  wrap(async (req, res) => {
    await teacherOnly(req);
    const data = questionActivationSchema.parse(req.body);
    res.json(
      await setQuestionActive(questionId(req), data.version, data.isActive),
    );
  }),
);
app.put(
  "/api/questions/:id",
  wrap(async (req, res) => {
    await teacherOnly(req);
    const data = questionUpdateSchema.parse(req.body);
    res.json(
      await updateQuestion(questionId(req), data.version, data.question),
    );
  }),
);
app.delete(
  "/api/questions/:id",
  wrap(async (req, res) => {
    await teacherOnly(req);
    const data = questionVersionSchema.parse(req.body);
    await deleteQuestion(questionId(req), data.version);
    res.json({ ok: true });
  }),
);
app.get(
  "/api/auth/me",
  wrap(async (req, res) => {
    const who = await identity(req);
    requireThat(who.kind === "teacher", "forbidden", 403);
    const teacher = await Teacher.findByPk(who.id);
    res.json({
      id: teacher?.id,
      name: teacher?.name,
      email: teacher?.email,
      role: teacher?.role,
    });
  }),
);
app.get(
  "/api/games",
  wrap(async (req, res) => {
    const who = await identity(req);
    requireThat(who.kind === "teacher", "forbidden", 403);
    res.json(
      await Game.findAll({
        where: { teacherId: who.id },
        order: [["id", "DESC"]],
      }),
    );
  }),
);
app.post(
  "/api/games",
  wrap(async (req, res) => {
    const who = await identity(req);
    requireThat(who.kind === "teacher", "forbidden", 403);
    const data = z
      .object({
        questionCount: z.number().int().min(1).max(20),
        questionDurationSeconds: z.number().int().min(10).max(120),
        difficulty: z.string().trim().max(120).optional(),
      })
      .strict()
      .parse(req.body);
    res
      .status(201)
      .json(
        await createGame(
          who.id,
          data.questionCount,
          data.questionDurationSeconds,
          data.difficulty,
        ),
      );
  }),
);
app.use("/api/join", rateLimit({ windowMs: 60_000, limit: 100 }));
app.get(
  "/api/join/:code",
  wrap(async (req, res) => {
    const game = await Game.findOne({
      where: { code: String(req.params.code).toUpperCase() },
    });
    requireThat(game, "game_not_found", 404);
    requireThat(game.status === "LOBBY", "game_closed");
    res.json({ code: game.code });
  }),
);
app.post(
  "/api/join",
  wrap(async (req, res) => {
    const data = z
      .object({
        code: z
          .string()
          .length(6)
          .transform((s) => s.toUpperCase()),
        name: z.string().trim().min(1).max(40),
        avatar: z.enum(avatars),
      })
      .strict()
      .parse(req.body);
    res.status(201).json(await join(data.code, data.name, data.avatar));
  }),
);
app.get(
  "/api/games/:id",
  wrap(async (req, res) =>
    res.json(
      await snapshot(
        await identity(req),
        z.coerce.number().int().positive().parse(req.params.id),
      ),
    ),
  ),
);
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const result = errorPayload(error);
  res.status(result.status).json({ error: result.error });
});
