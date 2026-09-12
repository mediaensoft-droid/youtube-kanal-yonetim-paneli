import "server-only";
import NextAuth, { CredentialsSignin } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { getOrCreateUserByEmail, getUserById } from "@/lib/db/users";
import { ensureTrialSubscription } from "@/lib/db/subscriptions";
import { ensureOwnerMember, getMemberById, getMemberByUsername, getMemberPasswordHash, touchMemberLogin } from "@/lib/db/members";
import { logActivity } from "@/lib/db/activity";
import { verifyPassword } from "@/lib/password";
import { hasActiveAccess } from "@/lib/access";
import { staffLoginSchema } from "@/lib/validation";
import type { MemberRole } from "@/lib/roles";

export interface Actor {
  workspaceId: number;
  memberId: number;
  role: MemberRole;
  displayName: string;
  /** The Google-authenticated workspace owner (has /profile and billing); staff — even yonetici — use /account. */
  isOwner: boolean;
  /** Owner sessions: true once the profile password was entered (or no password is set). */
  unlocked: boolean;
}

// NextAuth surfaces `code` to the client's `signIn(..., { redirect: false })` result, so the
// sign-in page can map these to Turkish copy without the server leaking anything else.
class DisabledError extends CredentialsSignin {
  code = "DISABLED";
}
class NoAccessError extends CredentialsSignin {
  code = "NO_ACCESS";
}

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
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
        await logActivity(
          { workspaceId: member.userId, memberId: member.id },
          { action: "auth.login", entityType: "auth" }
        );
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
    async jwt({ token, user, account, trigger, session }) {
      // /api/profiles/unlock verified the owner password → flip the flag on the live token.
      if (trigger === "update" && session && typeof session === "object" && "ownerUnlocked" in session) {
        token.ownerUnlocked = Boolean((session as { ownerUnlocked?: boolean }).ownerUnlocked);
        return token;
      }
      if (user && account?.provider === "staff" && user.workspaceId && user.memberId && user.role) {
        token.userId = user.workspaceId;
        token.memberId = user.memberId;
        token.role = user.role;
        token.displayName = user.name ?? "";
        token.isOwner = false;
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
        token.isOwner = true;
        // A fresh Google sign-in starts locked when the owner has set a profile password.
        token.ownerUnlocked = !(await getMemberPasswordHash(owner.id));
        // `user` is only set on the actual sign-in request, never on later JWT refreshes — so
        // this only fires once per real login, same as the staff branch above.
        await logActivity({ workspaceId: dbUser.id, memberId: owner.id }, { action: "auth.login", entityType: "auth" });
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
          token.isOwner = true;
          token.ownerUnlocked = true;
        }
      }
      return token;
    },
    async session({ session, token }) {
      const userId = Number(token.userId);
      if (session.user && userId) {
        session.user.id = String(userId);
        // Staff role/name come from the live member row (see below) so a promotion/demotion
        // takes effect immediately instead of after the JWT expires; owners keep token.role.
        let liveRole: MemberRole | undefined;
        // Tokens minted before isOwner existed belong to Google owners (staff tokens always set it).
        const isOwner = token.isOwner !== false;
        if (isOwner) {
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
          session.user.image = member.image;
          liveRole = member.role;
        }
        session.member = {
          id: Number(token.memberId),
          role: liveRole ?? token.role ?? "yonetici",
          displayName: session.user.name ?? "",
          isOwner,
          unlocked: isOwner ? token.ownerUnlocked !== false : true,
        };
      }
      return session;
    },
  },
});

export async function getSessionUserId(): Promise<number | null> {
  const session = await auth();
  const id = session?.user?.id;
  // A locked owner (Google signed in, profile password not yet entered on /profiles) has no
  // access to any page or API until they unlock — /sign-in routes them to /profiles.
  if (session?.member && session.member.isOwner && !session.member.unlocked) return null;
  return id ? Number(id) : null;
}

/** Owner session that still needs the profile password (used by /sign-in and /profiles). */
export async function getLockedOwnerSession() {
  const session = await auth();
  if (session?.user?.id && session.member?.isOwner && !session.member.unlocked) return session;
  return null;
}

export async function getSessionActor(): Promise<Actor | null> {
  const session = await auth();
  if (!session?.user?.id || !session.member?.id) return null;
  if (session.member.isOwner && !session.member.unlocked) return null;
  return {
    workspaceId: Number(session.user.id),
    memberId: session.member.id,
    role: session.member.role,
    displayName: session.member.displayName,
    isOwner: session.member.isOwner,
    unlocked: session.member.unlocked,
  };
}
