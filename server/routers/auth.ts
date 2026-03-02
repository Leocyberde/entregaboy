import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, router } from "../\_core/trpc";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "../\_core/cookies";
import { sdk } from "../\_core/sdk";
import {
  hashPassword,
  verifyPassword,
  generateResetToken,
  isValidCPF,
  isValidCNPJ,
  formatCPF,
  formatCNPJ,
} from "../services/auth";
import {
  findUserByDocument,
  createUser,
  setResetToken,
  findUserByResetToken,
  updatePassword,
} from "../services/db-auth";

export const authRouter = router({
  /**
   * Register new cliente (pessoa física)
   */
  registerClienteFisica: publicProcedure
    .input(
      z.object({
        name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
        cpf: z.string().min(1, "CPF é obrigatório"),
        password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres"),
        email: z.string().email("Email inválido").optional(),
        phone: z.string().optional(),
        rememberMe: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const cpf = formatCPF(input.cpf);

      if (!isValidCPF(cpf)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "CPF inválido",
        });
      }

      const existing = await findUserByDocument(cpf);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "CPF já cadastrado",
        });
      }

      const passwordHash = await hashPassword(input.password);

      const result = await createUser({
        name: input.name,
        cpf,
        passwordHash,
        role: "cliente",
        personType: "fisica",
        email: input.email,
        phone: input.phone,
      });

      return {
        success: true,
        userId: (result as any).insertId || 0,
        message: "Cadastro realizado com sucesso",
      };
    }),

  /**
   * Register new cliente (pessoa jurídica)
   */
  registerClienteJuridica: publicProcedure
    .input(
      z.object({
        name: z.string().min(3, "Razão social deve ter pelo menos 3 caracteres"),
        cnpj: z.string().min(14, "CNPJ inválido"),
        password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres"),
        email: z.string().email("Email inválido").optional(),
        phone: z.string().optional(),
        rememberMe: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const cnpj = formatCNPJ(input.cnpj);

      if (!isValidCNPJ(cnpj)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "CNPJ inválido",
        });
      }

      const existing = await findUserByDocument(undefined, cnpj);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "CNPJ já cadastrado",
        });
      }

      const passwordHash = await hashPassword(input.password);

      const result = await createUser({
        name: input.name,
        cnpj,
        passwordHash,
        role: "cliente",
        personType: "juridica",
        email: input.email,
        phone: input.phone,
      });

      return {
        success: true,
        userId: (result as any).insertId || 0,
        message: "Cadastro realizado com sucesso",
      };
    }),

  /**
   * Register new motoboy
   */
  registerMotoboy: publicProcedure
    .input(
      z.object({
        name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
        cpf: z.string().min(1, "CPF é obrigatório"),
        password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres"),
        email: z.string().email("Email inválido").optional(),
        phone: z.string().optional(),
        vehicleModel: z.string().optional(),
        vehiclePlate: z.string().optional(),
        rememberMe: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const cpf = formatCPF(input.cpf);

      if (!isValidCPF(cpf)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "CPF inválido",
        });
      }

      const existing = await findUserByDocument(cpf);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "CPF já cadastrado",
        });
      }

      const passwordHash = await hashPassword(input.password);

      const result = await createUser({
        name: input.name,
        cpf,
        passwordHash,
        role: "motoboy",
        email: input.email,
        phone: input.phone,
      });

      return {
        success: true,
        userId: (result as any).insertId || 0,
        message: "Cadastro realizado com sucesso. Aguarde aprovação do administrador.",
      };
    }),

  /**
   * Login with CPF and password
   */
  login: publicProcedure
    .input(
      z.object({
        cpf: z.string().min(1, "CPF é obrigatório"),
        password: z.string().min(8, "Senha inválida"),
        rememberMe: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const cpf = formatCPF(input.cpf);

      const user = await findUserByDocument(cpf);
      if (!user || !user.passwordHash) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "CPF ou senha incorretos",
        });
      }

      const isPasswordValid = await verifyPassword(input.password, user.passwordHash);
      if (!isPasswordValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "CPF ou senha incorretos",
        });
      }

      // Create a session token for the local user
      const sessionToken = await sdk.createSessionToken(String(user.id), {
        name: user.name || "",
      });

      // Set the session cookie
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: input.rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000, // 30 days or 24 hours
      });

      return {
        success: true,
        userId: user.id,
        name: user.name,
        role: user.role,
        isApproved: user.isApproved,
        message: "Login realizado com sucesso",
      };
    }),

  /**
   * Request password reset
   */
  requestPasswordReset: publicProcedure
    .input(
      z.object({
        cpf: z.string().min(1, "CPF é obrigatório"),
      })
    )
    .mutation(async ({ input }) => {
      const cpf = formatCPF(input.cpf);

      const user = await findUserByDocument(cpf);
      if (!user) {
        // Don't reveal if user exists for security
        return {
          success: true,
          message: "Se o CPF existir, um email será enviado com instruções para recuperar a senha",
        };
      }

      const token = generateResetToken();
      const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

      await setResetToken(user.id, token, expiresAt);

      // TODO: Send email with reset link
      // For now, return token for testing
      return {
        success: true,
        token, // Remove in production
        message: "Email de recuperação enviado",
      };
    }),

  /**
   * Reset password with token
   */
  resetPassword: publicProcedure
    .input(
      z.object({
        token: z.string().min(32, "Token inválido"),
        password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres"),
      })
    )
    .mutation(async ({ input }) => {
      const user = await findUserByResetToken(input.token);
      if (!user || !user.resetTokenExpires || user.resetTokenExpires < new Date()) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Token expirado ou inválido",
        });
      }

      const passwordHash = await hashPassword(input.password);
      await updatePassword(user.id, passwordHash);

      return {
        success: true,
        message: "Senha alterada com sucesso",
      };
    }),
});
