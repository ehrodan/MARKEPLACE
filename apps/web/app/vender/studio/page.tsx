import type { Metadata } from "next";
import { ReliefStudio } from "@/components/studio/relief-studio";

export const metadata: Metadata = {
  title: "Studio de relevo 2,5D",
  description: "Prévia local e honesta de relevo 2,5D para imagens de itens digitais.",
};

export default function Page() {
  return <ReliefStudio />;
}
