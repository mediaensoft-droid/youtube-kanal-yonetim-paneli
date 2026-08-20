import "server-only";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getOrCreateUserByEmail } from "@/lib/db/users";

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
        token.userId = dbUser.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        session.user.id = String(token.userId);
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
