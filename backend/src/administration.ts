import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";
import { EventEmitter } from "node:events";
import { Op, Transaction } from "sequelize";
import { z } from "zod";
import { db, Teacher, Entity } from "./db";
import { requireThat } from "./domain";

export const accountEvents = new EventEmitter();
export const accountFields = ["id", "name", "email", "role", "isActive"];
export function requireActiveAccount(account: Entity | null) {
  requireThat(account && !account.deletedAt, "unauthorized", 401);
  requireThat(account.isActive, "account_disabled", 403);
  return account;
}
export async function requireAdministrator(
  id: number,
  transaction?: Transaction,
) {
  const account = requireActiveAccount(
    await Teacher.findByPk(id, { transaction }),
  );
  requireThat(account.role === "admin", "forbidden", 403);
  return account;
}
export async function listTeachers(
  adminId: number,
  search: string,
  page: number,
) {
  await requireAdministrator(adminId);
  const result = await Teacher.findAndCountAll({
    where: {
      role: "teacher",
      deletedAt: null,
      ...(search
        ? {
            [Op.or]: [
              { name: { [Op.like]: `%${search}%` } },
              { email: { [Op.like]: `%${search}%` } },
            ],
          }
        : {}),
    },
    attributes: accountFields,
    order: [["id", "DESC"]],
    limit: 25,
    offset: (page - 1) * 25,
  });
  return { teachers: result.rows, total: result.count, page };
}
export async function changeTeacher(
  adminId: number,
  id: number,
  active: boolean | null,
) {
  await db.transaction(async (transaction) => {
    await requireAdministrator(adminId, transaction);
    const teacher = await Teacher.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    requireThat(teacher && !teacher.deletedAt, "teacher_not_found", 404);
    requireThat(
      teacher.role === "teacher" && teacher.id !== adminId,
      "protected_account",
      403,
    );
    if (active === null) {
      await teacher.update(
        {
          isActive: false,
          deletedAt: new Date(),
          name: "Profesor eliminado",
          email: `deleted-${teacher.id}@invalid.local`,
          passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 12),
          sessionVersion: teacher.sessionVersion + 1,
        },
        { transaction },
      );
    } else if (teacher.isActive !== active) {
      await teacher.update(
        { isActive: active, sessionVersion: teacher.sessionVersion + 1 },
        { transaction },
      );
    }
  });
  accountEvents.emit("changed", id);
}

// No default password and no elevation through public registration.
export async function ensureAdministrator() {
  if (!process.env.ADMIN_EMAIL && !process.env.ADMIN_PASSWORD) return;
  const config = z
    .object({
      email: z
        .string()
        .email()
        .max(120)
        .transform((s) => s.toLowerCase()),
      password: z
        .string()
        .min(16)
        .max(72)
        .refine((s) => Buffer.byteLength(s) <= 72),
      name: z.string().trim().min(1).max(60),
    })
    .safeParse({
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      name: process.env.ADMIN_NAME || "Administrador",
    });
  requireThat(config.success, "invalid_admin_configuration", 500);
  const existing = await Teacher.findOne({
    where: { email: config.data.email },
  });
  if (existing) {
    requireThat(
      existing.role === "admin" && !existing.deletedAt,
      "admin_email_already_used",
      500,
    );
    return;
  }
  await Teacher.create({
    name: config.data.name,
    email: config.data.email,
    passwordHash: await bcrypt.hash(config.data.password, 12),
    role: "admin",
    isActive: true,
  });
}
