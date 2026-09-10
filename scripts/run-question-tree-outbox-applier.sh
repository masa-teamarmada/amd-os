#!/bin/zsh
set -u

export PATH="/Users/masa/.local/node-current/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

REPO_DIR="/Users/masa/projects/AMD/amd-os-automation-runtime"
AUTOMATION_DIR="/Users/masa/.codex/automations/amd-os-l11-question-extract"
OUTBOX_DIR="${AUTOMATION_DIR}/outbox"
LOG_DIR="${AUTOMATION_DIR}/logs"
LOG_FILE="${LOG_DIR}/outbox-applier.log"
LOCK_DIR="${AUTOMATION_DIR}/.outbox-applier.lock"

mkdir -p "${OUTBOX_DIR}" "${LOG_DIR}"
COUNT=$(find "${OUTBOX_DIR}" -maxdepth 1 -type f -name '*.json' 2>/dev/null | wc -l | tr -d ' ')
if [ "${COUNT}" = "0" ]; then
  exit 0
fi

if ! mkdir "${LOCK_DIR}" 2>/dev/null; then
  exit 0
fi
trap 'rmdir "${LOCK_DIR}" 2>/dev/null || true' EXIT

{
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] applying question-tree=${COUNT} outbox file(s)"
  cd "${REPO_DIR}" || exit 1
  node pwa/scripts/apply_question_tree_outbox.mjs --dir "${OUTBOX_DIR}"
  STATUS=$?
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] done status=${STATUS}"
  exit ${STATUS}
} >> "${LOG_FILE}" 2>&1
