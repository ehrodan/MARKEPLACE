import type { Metadata } from "next";
import { ReviewsView } from "@/components/reputation/reviews-view";

export const metadata: Metadata = { title: "Avaliações" };

export default function Page() {
  return <ReviewsView />;
}
