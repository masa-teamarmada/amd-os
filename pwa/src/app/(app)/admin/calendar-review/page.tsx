import type { Metadata } from "next";
import { CalendarReviewClient } from "@/components/admin/calendar-review/CalendarReviewClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Admin Calendar Review - AMD OS" } };

export default function CalendarReviewPage() {
  return <CalendarReviewClient />;
}
