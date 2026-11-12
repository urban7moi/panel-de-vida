import type { Metadata } from "next";
import EntrenoScreen from "@/components/EntrenoScreen";

export const metadata: Metadata = { title: "Entreno · Panel de Vida" };

export default function Page() {
  return <EntrenoScreen />;
}
