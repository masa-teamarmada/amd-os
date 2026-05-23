import { PaymentConfirmClient } from "./PaymentConfirmClient";

export default async function PaymentConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return <PaymentConfirmClient token={params.token || ""} />;
}
