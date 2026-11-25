# h1 の会議カード作成 runner と見直し runner が共通で読む、Codex の実行ファイルとモデルの決め方。
#
# 2026-10-15 から、ChatGPT アカウントの Codex で gpt-5.5 が使えなくなり（model_not_in_accessible_catalog）、
# 両 runner が毎回20秒ほどで失敗して会議カードが作られなくなった。PATH 上の npm 版 codex（0.139）は
# 新しいモデルも受け付けないため、ChatGPT アプリに同梱され、アプリと一緒に更新される codex を優先する。
# モデルは AGENTS.common.md で Codex の高度な作業に指定されている gpt-6.1-sol を既定にし、
# H1_CODEX_MODEL / H1_CODEX_BIN で上書きできる。

H1_CODEX_APP_BIN="/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex"
if [[ -n "${H1_CODEX_BIN:-}" ]]; then
  :
elif [[ -x "${H1_CODEX_APP_BIN}" ]]; then
  H1_CODEX_BIN="${H1_CODEX_APP_BIN}"
else
  H1_CODEX_BIN="$(command -v codex)"
fi
H1_CODEX_MODEL="${H1_CODEX_MODEL:-gpt-6.1-sol}"
