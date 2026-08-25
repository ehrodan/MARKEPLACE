import type { Metadata } from "next";
import { AchievementsView } from "@/components/progression/achievements-view";

export const metadata: Metadata = { title: "Conquistas" };

export default function AccountAchievementsPage() {
  return <AchievementsView />;
}
