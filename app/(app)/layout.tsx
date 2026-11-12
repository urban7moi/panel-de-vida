import TabBar from "@/components/TabBar";
import { requireAuth } from "@/lib/requireAuth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return (
    <>
      {children}
      <TabBar />
    </>
  );
}
