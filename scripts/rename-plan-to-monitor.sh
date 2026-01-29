#!/usr/bin/env bash
# Rename Monitor → Monitor across the repo. Run from repo root.
# See RENAME_MONITOR_TO_MONITOR.md for strategy.

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Files to process: ts, js, json, md, yml, yaml, sh — exclude node_modules and .git
find . -type f \( \
  -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.json' -o \
  -name '*.md' -o -name '*.yml' -o -name '*.yaml' -o -name '*.sh' \
\) ! -path '*/node_modules/*' ! -path '*/.git/*' | while IFS= read -r f; do
  # Compounds first (so "monitor" in paths/identifiers is updated before word-boundary pass)
  perl -i -pe 's/monitor-diff/monitor-diff/g; s/monitor-mapper/monitor-mapper/g; s/test-monitor/test-monitor/g; s/monitor_version/monitor_version/g' "$f" 2>/dev/null || true
  # Pascal / uppercase
  perl -i -pe 's/Monitor/Monitor/g; s/Monitors/Monitors/g; s/MONITOR/MONITOR/g; s/Monitorned/Monitored/g; s/Monitorning/Monitoring/g' "$f" 2>/dev/null || true
  # Lowercase with word boundary (avoids e.g. "explain" → "exmonitor")
  perl -i -pe 's/\bplan\b/monitor/g; s/\bplans\b/monitors/g; s/\bplanned\b/monitored/g; s/\bplanning\b/monitoring/g' "$f" 2>/dev/null || true
done

# Rename files and directories
mv -f griffin-cli/src/commands/hub/monitor.ts griffin-cli/src/commands/hub/monitor.ts 2>/dev/null || true
mv -f griffin-cli/src/core/monitor-diff.ts griffin-cli/src/core/monitor-diff.ts 2>/dev/null || true
mv -f griffin-hub/src/storage/monitor-mapper.ts griffin-hub/src/storage/monitor-mapper.ts 2>/dev/null || true
mv -f griffin-hub/src/schemas/monitors.ts griffin-hub/src/schemas/monitors.ts 2>/dev/null || true
mv -f griffin-hub/src/routes/monitor griffin-hub/src/routes/monitor 2>/dev/null || true
mv -f griffin-executor/src/test-monitor-types.ts griffin-executor/src/test-monitor-types.ts 2>/dev/null || true
mv -f MONITOR_VERSIONING.md MONITOR_VERSIONING.md 2>/dev/null || true

echo "Content and file renames done. Regenerate OpenAPI/SDK if needed (see RENAME_MONITOR_TO_MONITOR.md)."
