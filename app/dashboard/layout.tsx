import type { ReactNode } from "react";

import { DashboardHeader } from "@/components/dashboard/DashboardHeader";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <DashboardHeader />
      <main className="flex-1 px-4 py-6 md:px-8 max-w-[1600px] mx-auto w-full">{children}</main>
    </div>
  );
}
