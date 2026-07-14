import type { Metadata } from "next";
import { BusinessCardsClient } from "@/components/business-cards/BusinessCardsClient";

export const metadata: Metadata = {
  title: { absolute: "名刺 - AMD OS" },
};

export default function NativeBusinessCardsPage() {
  return <BusinessCardsClient />;
}
