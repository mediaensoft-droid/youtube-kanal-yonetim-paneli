import type { DefaultSession } from "next-auth";
import type { MemberRole } from "@/lib/roles";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
    member: { id: number; role: MemberRole; displayName: string };
  }
  interface User {
    /** Set by the Credentials provider so the jwt callback can attribute the workspace. */
    workspaceId?: number;
    memberId?: number;
    role?: MemberRole;
  }
}

// `next-auth/jwt` is a bare `export *` re-export, so augmenting it never reaches the real JWT
// interface (tsc silently types the fields as `unknown`). Augment the source module instead.
declare module "@auth/core/jwt" {
  interface JWT {
    userId?: number;
    memberId?: number;
    role?: MemberRole;
    displayName?: string;
  }
}
