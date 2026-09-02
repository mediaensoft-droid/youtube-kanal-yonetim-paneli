import "server-only";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getOrCreateUserByEmail, getUserById } from "@/lib/db/users";
import { ensureTrialSubscription } from "@/lib/db/subscriptions";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    async signIn({ user }) {
      return Boolean(user.email);
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const dbUser = await getOrCreateUserByEmail(user.email, user.name ?? null, user.image ?? null);
        await ensureTrialSubscription(dbUser.id);
        token.userId = dbUser.id;
      }
      return token;
    },
    async session({ session, token }) {
      const userId = Number(token.userId);
      if (session.user && userId) {
        session.user.id = String(userId);
        // The DB row (editable on /profile) is the source of truth for name/image, not
        // whatever Google's token happened to carry at sign-in time.
        const dbUser = await getUserById(userId);
        if (dbUser) {
          session.user.name = dbUser.name;
          session.user.image = dbUser.image;
        }
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
