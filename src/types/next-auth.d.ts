import type { DefaultSession } from "next-auth";
import type { MemberRole } from "@/lib/roles";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
    /** Absent when a staff member has been disabled/removed after sign-in (id is blanked too). */
    member?: { id: number; role: MemberRole; displayName: string; isOwner: boolean };
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
    /** true for the Google-authenticated workspace owner; false for username/password staff. */
    isOwner?: boolean;
  }
}
