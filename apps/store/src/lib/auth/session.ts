import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/lib/db";
import { companies, users } from "@/lib/db/schema";
import { getEnv } from "@/lib/env";
import { SESSION_COOKIE, SESSION_HOURS, decodeSession, encodeSession } from "./session-token";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  jobTitle: string;
  company: typeof companies.$inferSelect;
};

/** The signed-in buyer and their company, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = decodeSession(token, getEnv().APP_SECRET);
  if (!session) return null;

  const [row] = await getDb()
    .select({ user: users, company: companies })
    .from(users)
    .innerJoin(companies, eq(users.companyId, companies.id))
    .where(eq(users.id, session.userId));
  if (!row) return null;
  return { id: row.user.id, name: row.user.name, email: row.user.email, jobTitle: row.user.jobTitle, company: row.company };
});

export async function requireUser(nextPath: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  return user;
}

export async function startSession(userId: string): Promise<void> {
  const env = getEnv();
  (await cookies()).set(SESSION_COOKIE, encodeSession(userId, env.APP_SECRET), {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
