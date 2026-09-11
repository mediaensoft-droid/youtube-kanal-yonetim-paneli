"use client";

import { useSession } from "next-auth/react";
import { can as canRole, type MemberRole, type Permission } from "@/lib/roles";

export function useActor() {
  const { data } = useSession();
  const role: MemberRole | null = data?.member?.role ?? null;
  return {
    role,
    displayName: data?.member?.displayName ?? "",
    can: (permission: Permission) => (role ? canRole(role, permission) : false),
  };
}
