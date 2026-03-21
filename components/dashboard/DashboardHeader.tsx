"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

import { RukaPayLogoMark } from "@/components/branding/RukaPayLogo";
import { Button } from "@/components/ui/button";

export function DashboardHeader() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b bg-card">
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <RukaPayLogoMark size={40} priority />
          <div className="min-w-0">
            <p className="font-outfit font-semibold text-lg leading-tight">RukaPay</p>
            <p className="text-xs text-muted-foreground truncate">Executive analytics · data.rukapay</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={logout} type="button">
          <LogOut className="size-4" />
          Log out
        </Button>
      </div>
    </header>
  );
}
