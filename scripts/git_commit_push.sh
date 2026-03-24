#!/usr/bin/env bash
set -euo pipefail

# Helper: ensure repo up-to-date then commit and push
# Usage: ./scripts/git_commit_push.sh -m "commit message" [--no-push]

MSG=""
NOPUSH=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    -m|--message)
      shift
      MSG="$1"
      shift
      ;;
    --no-push)
      NOPUSH=1
      shift
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$MSG" ]]; then
  echo "Commit message required. Use -m \"message\"" >&2
  exit 2
fi

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

# stash untracked changes not relevant? use autostash with rebase
echo "-> Fetching latest and rebasing"
# Ensure working tree has no unmerged files
if git ls-files -u | grep -q .; then
  echo "Error: repository has unmerged files. Resolve conflicts first." >&2
  exit 3
fi

git fetch origin
# attempt rebase with autostash (if local commits exist)
if git rev-parse --abbrev-ref HEAD >/dev/null 2>&1; then
  CUR_BRANCH=$(git rev-parse --abbrev-ref HEAD || echo '')
# If detached HEAD, default to 'main'
if [[ "$CUR_BRANCH" == "HEAD" || -z "$CUR_BRANCH" ]]; then
  CUR_BRANCH=main
fi
else
  CUR_BRANCH="main"
fi

git pull --rebase --autostash origin "$CUR_BRANCH"

# Add and commit
echo "-> Staging changes"
git add -A

echo "-> Committing: $MSG"
git commit -m "$MSG" || echo "No changes to commit"

if [[ $NOPUSH -eq 0 ]]; then
  echo "-> Pushing to origin/$CUR_BRANCH"
  git push origin "$CUR_BRANCH"
else
  echo "-> Skipping push (--no-push)"
fi

echo "Done." 
