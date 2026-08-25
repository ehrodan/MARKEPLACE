import type { Metadata } from "next";
import { MasterControlView } from "@/components/operations/master-control-view";

export const metadata: Metadata = { title: "Controle master" };

export default function MasterPage() {
  return <MasterControlView />;
}
