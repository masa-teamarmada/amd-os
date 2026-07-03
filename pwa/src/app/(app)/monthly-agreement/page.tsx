"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  currentYmJst,
  MonthlyAgreementExperience,
  MonthlyAgreementLoading,
} from "@/components/monthly-agreement/MonthlyAgreementExperience";

export default function MonthlyAgreementPage() {
  return (
    <Suspense fallback={<MonthlyAgreementLoading />}>
      <MonthlyAgreementPageContent />
    </Suspense>
  );
}

function MonthlyAgreementPageContent() {
  const searchParams = useSearchParams();
  return (
    <MonthlyAgreementExperience
      mode="page"
      initialYm={searchParams.get("ym") || currentYmJst()}
      initialMemberId={searchParams.get("memberId") || ""}
    />
  );
}
