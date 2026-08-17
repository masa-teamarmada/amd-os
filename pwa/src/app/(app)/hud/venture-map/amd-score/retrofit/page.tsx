import { redirect } from "next/navigation";

export const metadata = {
  title: "HUD AMD Score Retrofit | AMD OS",
};

export const dynamic = "force-dynamic";

export default function RetiredHudScoreRetrofitRedirect() {
  redirect("/venture-map/amd-score");
}
