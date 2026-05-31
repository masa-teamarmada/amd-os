import { redirect } from "next/navigation";

/**
 * /bzm opens the first chapter directly so the reader immediately gets the
 * left-hand table of contents plus the 0-1 main text.
 */
export default function BzmIndexPage() {
  redirect("/bzm/0-1-preface");
}
