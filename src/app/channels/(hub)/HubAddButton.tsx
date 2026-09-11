"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";

// The hub's single add button follows the active tab: on "Planlanan Kanallar" it creates a
// planned (reference) channel, everywhere else one of the user's own.
export function HubAddButton() {
  const pathname = usePathname();
  const planned = pathname === "/channels/planned";
  return (
    <Link href={planned ? "/channels/new?status=planned" : "/channels/new"}>
      <Button>
        <Plus className="h-4 w-4" /> {planned ? "Planlanan Kanal Ekle" : "Kanal Ekle"}
      </Button>
    </Link>
  );
}
