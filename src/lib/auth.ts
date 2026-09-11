import "server-only";
import NextAuth, { CredentialsSignin } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { getOrCreateUserByEmail, getUserById } from "@/lib/db/users";
import { ensureTrialSubscription } from "@/lib/db/subscriptions";
import { ensureOwnerMember, getMemberById, getMemberByUsername, touchMemberLogin } from "@/lib/db/members";
import { verifyPassword } from "@/lib/password";
import { hasActiveAccess } from "@/lib/access";
import { staffLoginSchema } from "@/lib/validation";
import type { MemberRole } from "@/lib/roles";

export interface Actor {
  workspaceId: number;
  memberId: number;
  role: MemberRole;
  displayName: string;
}

// NextAuth surfaces `code` to the client's `signIn(..., { redirect: false })` result, so the
// sign-in page can map these to Turkish copy without the server leaking anything else.
class DisabledError extends CredentialsSignin {
  code = "DISABLED";
}
class NoAccessError extends CredentialsSignin {
  code = "NO_ACCESS";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({ clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET }),
    Credentials({
      id: "staff",
      name: "Personel",
      credentials: { username: {}, password: {} },
      async authorize(raw) {
        const parsed = staffLoginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const member = await getMemberByUsername(parsed.data.username);
        if (!member?.passwordHash) return null;
        if (!(await verifyPassword(parsed.data.password, member.passwordHash))) return null;
        if (member.status !== "active") throw new DisabledError();
        if (!(await hasActiveAccess(member.userId))) throw new NoAccessError();
        await touchMemberLogin(member.id);
        // `id` must be a string for NextAuth; the workspace/member ids ride along for the jwt callback.
        return { id: String(member.userId), name: member.displayName, workspaceId: member.userId, memberId: member.id, role: member.role };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in" },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "staff") return true;
      return Boolean(user.email);
    },
    async jwt({ token, user, account }) {
      if (user && account?.provider === "staff" && user.workspaceId && user.memberId && user.role) {
        token.userId = user.workspaceId;
        token.memberId = user.memberId;
        token.role = user.role;
        token.displayName = user.name ?? "";
        return token;
      }
      if (user?.email) {
        const dbUser = await getOrCreateUserByEmail(user.email, user.name ?? null, user.image ?? null);
        await ensureTrialSubscription(dbUser.id);
        const owner = await ensureOwnerMember(dbUser.id, dbUser.name ?? dbUser.email);
        token.userId = dbUser.id;
        token.memberId = owner.id;
        token.role = "yonetici";
        token.displayName = owner.displayName;
      }
      // Tokens minted before the members table existed carry userId only. They belong to
      // Google owners, so backfill the member fields instead of treating them as disabled staff.
      if (!user && token.userId && !token.memberId) {
        const dbUser = await getUserById(Number(token.userId));
        if (dbUser) {
          const owner = await ensureOwnerMember(dbUser.id, dbUser.name ?? dbUser.email);
          token.memberId = owner.id;
          token.role = "yonetici";
          token.displayName = owner.displayName;
        }
      }
      return token;
    },
    async session({ session, token }) {
      const userId = Number(token.userId);
      if (session.user && userId) {
        session.user.id = String(userId);
        if (token.role === "yonetici") {
          // The DB row (editable on /profile) is the source of truth for name/image, not
          // whatever Google's token happened to carry at sign-in time.
          const dbUser = await getUserById(userId);
          if (dbUser) {
            session.user.name = dbUser.name;
            session.user.image = dbUser.image;
          }
        } else {
          const member = token.memberId ? await getMemberById(token.memberId) : undefined;
          // A staff member removed or disabled after sign-in still holds a valid JWT (30 days).
          // Blank the id so getSessionUserId()/getSessionActor() yield null and every page and
          // API bounces them to sign-in immediately.
          if (member?.status !== "active") {
            return { ...session, user: { ...session.user, id: "" } };
          }
          session.user.name = member.displayName;
          session.user.image = null;
        }
        session.member = {
          id: Number(token.memberId),
          role: (token.role ?? "yonetici") as MemberRole,
          displayName: session.user.name ?? "",
        };
      }
      return session;
    },
  },
});

export async function getSessionUserId(): Promise<number | null> {
  const session = await auth();
  const id = session?.user?.id;
  return id ? Number(id) : null;
}

export async function getSessionActor(): Promise<Actor | null> {
  const session = await auth();
  if (!session?.user?.id || !session.member?.id) return null;
  return {
    workspaceId: Number(session.user.id),
    memberId: session.member.id,
    role: session.member.role,
    displayName: session.member.displayName,
  };
}
