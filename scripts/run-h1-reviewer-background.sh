#!/bin/zsh
set -euo pipefail

export PATH="/Users/masa/.local/node-current/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"
export CODEX_HOME="/Users/masa/.codex"
export H1_REVIEWER_BACKGROUND_RUNNER=1

REPO_DIR="/Users/masa/projects/AMD/amd-os"
AUTOMATION_DIR="${CODEX_HOME}/automations/amd-os-h-1-meeting-reviewer"
PROMPT_FILE="${REPO_DIR}/scripts/h1-reviewer-background-runner-prompt.md"
LOG_DIR="${AUTOMATION_DIR}/logs"
MODE="${1:-}"
WORK_DIR="${AUTOMATION_DIR}/background-work"

mkdir -p "${LOG_DIR}" "${AUTOMATION_DIR}/runner-output" "${WORK_DIR}"

if [[ "${MODE}" != "--force" && "${MODE}" != "--probe" ]]; then
  weekday=$(date +%u)
  hour=$(date +%H)
  if (( weekday > 5 || 10#${hour} > 12 )); then
    exit 0
  fi
fi

timestamp=$(date '+%Y%m%dT%H%M%S')
gate_file="${AUTOMATION_DIR}/runner-output/${timestamp}-reviewer-gate.json"
completion_marker="${AUTOMATION_DIR}/run_state/background_completed/${timestamp}.json"
transcript_file=$(mktemp "${TMPDIR:-/tmp}/amd-os-h1-reviewer-${timestamp}.XXXXXX")
last_message_file=$(mktemp "${TMPDIR:-/tmp}/amd-os-h1-reviewer-last-${timestamp}.XXXXXX")
trap 'rm -f "${transcript_file}" "${last_message_file}"' EXIT

if [[ "${MODE}" == "--probe" ]]; then
  prompt='これは非可視バックグラウンドrunnerの疎通確認。外部サービス、DB、ファイルを変更せず、本文を読まず、BACKGROUNDRUNNER_PROBE_OK だけを返して終了する。'
else
  set +e
  node "${REPO_DIR}/pwa/scripts/h1_reviewer_candidate_gate.mjs" \
    --output "${gate_file}" \
    --h1-reports-dir "/Users/masa/.codex/automations/amd-os-l6-meeting-flow/reports" \
    --ledger-file "${AUTOMATION_DIR}/aggregated_h1_reports.json" \
    --empty-report-dir "${AUTOMATION_DIR}/reports" \
    --memory-file "${AUTOMATION_DIR}/memory.md"
  gate_status=$?
  set -e
  if [[ "${gate_status}" == "0" ]]; then
    print -- "[$(date '+%F %T %Z')] h1 reviewer candidate gate: no candidates"
    exit 0
  fi
  if [[ "${gate_status}" != "10" ]]; then
    print -- "[$(date '+%F %T %Z')] h1 reviewer candidate gate failed status=${gate_status}"
    exit "${gate_status}"
  fi
  prompt=$(<"${PROMPT_FILE}")
  prompt="${prompt}\n\n固定候補gateは完了済み。候補一覧は ${gate_file} にある。この一覧だけを起点に処理する。"
fi

{
  print -- "[$(date '+%F %T %Z')] h1 reviewer background runner start mode=${MODE:-scheduled}"
  if H1_REVIEWER_BACKGROUND_RUN_ID="${timestamp}" codex exec --ephemeral -m gpt-5.5 -C "${WORK_DIR}" --skip-git-repo-check -s danger-full-access -o "${last_message_file}" "${prompt}" >"${transcript_file}" 2>&1; then
    print -- "[$(date '+%F %T %Z')] h1 reviewer background runner done"
  else
    exit_code=$?
    if [[ -f "${completion_marker}" ]]; then
      print -- "[$(date '+%F %T %Z')] h1 reviewer background runner completed before nonzero exit=${exit_code}"
      exit 0
    fi
    print -- "[$(date '+%F %T %Z')] h1 reviewer background runner failed exit=${exit_code}"
    exit "${exit_code}"
  fi
} >> "${LOG_DIR}/background-runner.log" 2>&1
