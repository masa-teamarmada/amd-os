"use client";

import { createContext, useContext } from "react";

/**
 * ログイン画面をどのアプリとして出すか。
 * 書斎のアドレス（bookshelf-armada.vercel.app）では「書斎」として、AMD OS のメンバー用ログインだけを出す。
 * 判定はサーバの login/layout.tsx が Host ヘッダで行い、最初の描画から書斎の見た目で出す。設計正本 bzm_reader.md §2.1
 */
export type LoginApp = "amd-os" | "shosai";

const LoginAppContext = createContext<LoginApp>("amd-os");

export function LoginAppProvider({ app, children }: { app: LoginApp; children: React.ReactNode }) {
  return <LoginAppContext.Provider value={app}>{children}</LoginAppContext.Provider>;
}

export function useLoginApp(): LoginApp {
  return useContext(LoginAppContext);
}
