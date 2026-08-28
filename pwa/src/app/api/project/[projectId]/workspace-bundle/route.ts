// PJコックピットの管制タブ (週次差分 / ガント / 関係先 / 論点・仮説) が読む束。
//
// 2026-08-28 まさ「コックピットとワークスペースを統合できそうじゃない？」で、
// ワークスペースの4タブをコックピットへ取り込んだ。取り込み先は AMD メンバー専用の
// `(app)` 配下なので、この route も `getCurrentMemberAccess()` だけで認可する。
// 大学・SU 側の共有アカウントはここを通らない (401)。
// 共有ワークスペース側の認可解決をこの route へ持ち込まないこと——持ち込むと、
// 内部前提で組み立てたコックピットの面が外部アカウントへ開く。
// (回帰防止: scripts/check_pwa_critical_ui.cjs)
//
// 可変系データ (週次の差分・関係先の状況・論点の判断) なのでキャッシュしない。
import { NextResponse } from "next/server";
import { getCurrentMemberAccess, getProjectWorkspaceBundle } from "@/lib/project-workspace";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" } as const;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await ctx.params;
  if (!projectId) {
    return NextResponse.json({ ok: false, error: "projectId required" }, { status: 400, headers: NO_STORE });
  }

  const access = await getCurrentMemberAccess();
  if (!access) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }

  try {
    const bundle = await getProjectWorkspaceBundle(projectId, access);
    // 権限が無い場合も「無い」と返す。PJの存在を漏らさない。
    if (!bundle) {
      return NextResponse.json({ ok: false, error: "この PJ の管制データは見られない" }, { status: 404, headers: NO_STORE });
    }
    return NextResponse.json(
      {
        ok: true,
        bundle,
        // 画面が使うのは表示名と、編集ボタンを出すかどうかの判定だけ。
        viewer: {
          memberId: access.memberId,
          codeName: access.codeName,
          displayName: access.displayName,
          email: access.email,
          isAdmin: access.isAdmin,
          scope: access.scope,
          calendarStatus: access.calendarStatus,
          projects: access.projects,
        },
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    console.error("[workspace-bundle]", error);
    return NextResponse.json({ ok: false, error: "PJ管制データの取得に失敗" }, { status: 500, headers: NO_STORE });
  }
}
