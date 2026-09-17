#!/bin/zsh
set -euo pipefail

export PATH="/Users/masa/.local/node-current/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"
export CODEX_HOME="/Users/masa/.codex"
export H1_REVIEWER_BACKGROUND_RUNNER=1

REPO_DIR="${AMD_OS_AUTOMATION_REPO_DIR:-/Users/masa/projects/AMD/amd-os}"
AUTOMATION_DIR="${CODEX_HOME}/automations/amd-os-h-1-meeting-reviewer"
PROMPT_FILE="${REPO_DIR}/scripts/h1-reviewer-background-runner-prompt.md"
LOG_DIR="${AUTOMATION_DIR}/logs"
MODE="${1:-}"
WORK_DIR="${AUTOMATION_DIR}/background-work"
SAFETY_STATE_FILE="${AUTOMATION_DIR}/run_state/runner_safety.json"
LOCK_DIR="${AUTOMATION_DIR}/run_state/background.lock"
EMERGENCY_STOP_FILE="${CODEX_HOME}/automations/amd-os-vercel-emergency-stop"

mkdir -p "${LOG_DIR}" "${AUTOMATION_DIR}/runner-output" "${WORK_DIR}"

if [[ "${MODE}" != "--probe" && -f "${EMERGENCY_STOP_FILE}" ]]; then
  print -- "[$(date '+%F %T %Z')] h1 reviewer emergency stop active"
  exit 75
fi

if ! mkdir "${LOCK_DIR}" 2>/dev/null; then
  lock_mtime=$(stat -f %m "${LOCK_DIR}" 2>/dev/null || print 0)
  now_epoch=$(date +%s)
  if (( now_epoch - lock_mtime > 1800 )); then
    mv "${LOCK_DIR}" "${LOCK_DIR}.stale.$(date '+%Y%m%dT%H%M%S')"
    mkdir "${LOCK_DIR}"
  else
    print -- "[$(date '+%F %T %Z')] h1 reviewer already active"
    exit 75
  fi
fi

if [[ "${MODE}" != "--probe" ]] && ! node "${REPO_DIR}/pwa/scripts/h1_runner_safety.mjs" check "${SAFETY_STATE_FILE}"; then
  rmdir "${LOCK_DIR}" 2>/dev/null || true
  exit 75
fi

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
trap 'rm -f "${transcript_file}" "${last_message_file}"; rmdir "${LOCK_DIR}" 2>/dev/null || true' EXIT

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
  prompt="${prompt}\n\nこのrunで参照するAMD OS repoは ${REPO_DIR}。固定候補gateは完了済み。候補一覧は ${gate_file} にある。この一覧だけを起点に処理する。"
fi

{
  print -- "[$(date '+%F %T %Z')] h1 reviewer background runner start mode=${MODE:-scheduled}"
  if H1_REVIEWER_BACKGROUND_RUN_ID="${timestamp}" node "${REPO_DIR}/pwa/scripts/run_bounded_command.mjs" --timeout-seconds 900 -- codex exec --ephemeral -m gpt-5.5 -C "${WORK_DIR}" --skip-git-repo-check -s danger-full-access -o "${last_message_file}" "${prompt}" >"${transcript_file}" 2>&1; then
    [[ "${MODE}" == "--probe" ]] || node "${REPO_DIR}/pwa/scripts/h1_runner_safety.mjs" success "${SAFETY_STATE_FILE}"
    print -- "[$(date '+%F %T %Z')] h1 reviewer background runner done"
  else
    exit_code=$?
    if [[ -f "${completion_marker}" ]]; then
      print -- "[$(date '+%F %T %Z')] h1 reviewer background runner completed before nonzero exit=${exit_code}"
      exit 0
    fi
    [[ "${MODE}" == "--probe" ]] || node "${REPO_DIR}/pwa/scripts/h1_runner_safety.mjs" failure "${SAFETY_STATE_FILE}"
    print -- "[$(date '+%F %T %Z')] h1 reviewer background runner failed exit=${exit_code}"
    exit "${exit_code}"
  fi
} >> "${LOG_DIR}/background-runner.log" 2>&1
