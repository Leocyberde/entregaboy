import { COOKIE_NAME } from "@shared/const";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import * as db from "../db";
import { parse as parseCookieHeader } from "cookie";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

function parseCookies(cookieHeader: string | undefined) {
  if (!cookieHeader) {
    return new Map<string, string>();
  }

  const parsed = parseCookieHeader(cookieHeader);
  return new Map(Object.entries(parsed));
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    const cookies = parseCookies(opts.req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    
    if (sessionCookie) {
      const session = await sdk.verifySession(sessionCookie);
      if (session && session.openId) {
        // Try to find by openId first (for OAuth)
        user = await db.getUserByOpenId(session.openId);
        
        // If not found by openId, it might be a local userId stored in openId field of the token
        if (!user) {
          const userId = parseInt(session.openId, 10);
          if (!isNaN(userId)) {
            user = (await db.getUserById(userId)) || null;
          }
        }
      }
    }
  } catch (error) {
    console.error("[Context] Auth failed:", error);
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
