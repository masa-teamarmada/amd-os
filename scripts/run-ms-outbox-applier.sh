#!/bin/zsh
set -u

export PATH="/Users/masa/.local/node-current/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

REPO_DIR="/Users/masa/projects/AMD/amd-os"
MS_AUTOMATION_DIR="/Users/masa/.codex/automations/amd-os-ms"
STRATEGY_OUTBOX_DIR="/Users/masa/.codex/automations/amd-os/strategy-signals-outbox"
ATLAS_AUTOMATION_DIR="/Users/masa/.codex/automations/amd-atlas"
LOG_DIR="${MS_AUTOMATION_DIR}/logs"
LOG_FILE="${LOG_DIR}/outbox-applier.log"

mkdir -p "${MS_AUTOMATION_DIR}/outbox" "${STRATEGY_OUTBOX_DIR}" "${ATLAS_AUTOMATION_DIR}/outbox" "${LOG_DIR}"

MS_COUNT=$(find "${MS_AUTOMATION_DIR}/outbox" -maxdepth 1 -type f -name '*.json' 2>/dev/null | wc -l | tr -d ' ')
STRATEGY_COUNT=$(find "${STRATEGY_OUTBOX_DIR}" -maxdepth 1 -type f -name '*.json' 2>/dev/null | wc -l | tr -d ' ')
ATLAS_COUNT=$(find "${ATLAS_AUTOMATION_DIR}/outbox" -maxdepth 1 -type f -name '*.json' 2>/dev/null | wc -l | tr -d ' ')
if [ "${MS_COUNT}" = "0" ] && [ "${STRATEGY_COUNT}" = "0" ] && [ "${ATLAS_COUNT}" = "0" ]; then
  exit 0
fi

{
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] applying amd-os-ms=${MS_COUNT} amd-os-strategy-signals=${STRATEGY_COUNT} amd-atlas=${ATLAS_COUNT} outbox file(s)"
  cd "${REPO_DIR}" || exit 1
  STATUS=0
  if [ "${MS_COUNT}" != "0" ]; then
    node pwa/scripts/ms_progress_review_tool.mjs apply-outbox-dir || STATUS=$?
  fi
  if [ "${STRATEGY_COUNT}" != "0" ]; then
    node pwa/scripts/ms_progress_review_tool.mjs apply-outbox-dir --dir "${STRATEGY_OUTBOX_DIR}" || STATUS=$?
  fi
  if [ "${ATLAS_COUNT}" != "0" ]; then
    node pwa/scripts/atlas_signal_review_tool.mjs apply-outbox-dir || STATUS=$?
  fi
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] done status=${STATUS}"
  exit ${STATUS}
} >> "${LOG_FILE}" 2>&1
