import { eq, or } from "drizzle-orm";
import { users } from "../../drizzle/schema";
import { getDb } from "../db";

/**
 * Find user by CPF or CNPJ
 */
export async function findUserByDocument(cpf?: string, cnpj?: string) {
  const db = await getDb();
  if (!db) return null;

  const conditions = [];
  if (cpf) conditions.push(eq(users.cpf, cpf));
  if (cnpj) conditions.push(eq(users.cnpj, cnpj));

  if (conditions.length === 0) return null;

  const result = await db
    .select()
    .from(users)
    .where(or(...conditions))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

/**
 * Create new user with password
 */
export async function createUser(data: {
  name: string;
  cpf?: string;
  cnpj?: string;
  passwordHash: string;
  role: "admin" | "cliente" | "motoboy";
  personType?: "fisica" | "juridica";
  phone?: string;
  email?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(users).values({
    name: data.name,
    cpf: data.cpf,
    cnpj: data.cnpj,
    passwordHash: data.passwordHash,
    role: data.role,
    personType: data.personType,
    phone: data.phone,
    email: data.email,
    openId: null, // Will be set later if using OAuth
    isApproved: data.role === "admin" ? true : false,
    isOnline: false,
  });

  return result;
}

/**
 * Update password reset token
 */
export async function setResetToken(userId: number, token: string, expiresAt: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(users)
    .set({
      resetToken: token,
      resetTokenExpires: expiresAt,
    })
    .where(eq(users.id, userId));
}

/**
 * Find user by reset token
 */
export async function findUserByResetToken(token: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(users)
    .where(eq(users.resetToken, token))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

/**
 * Update password
 */
export async function updatePassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(users)
    .set({
      passwordHash,
      resetToken: null,
      resetTokenExpires: null,
    })
    .where(eq(users.id, userId));
}
