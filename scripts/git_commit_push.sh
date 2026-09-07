#!/usr/bin/env bash
set -euo pipefail

# Build, validate, commit and optionally push the site.
# Usage: ./scripts/git_commit_push.sh -m "commit message" [--no-push]

MSG=""
NOPUSH=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    -m|--message)
      shift
      [[ $# -gt 0 ]] || { echo "Missing commit message" >&2; exit 2; }
      MSG="$1"
      shift
      ;;
    --no-push)
      NOPUSH=1
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

[[ -n "$MSG" ]] || { echo 'Commit message required. Use -m "message".' >&2; exit 2; }

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

if git ls-files -u | grep -q .; then
  echo "Repository has unresolved merge conflicts." >&2
  exit 3
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[[ "$BRANCH" != "HEAD" ]] || BRANCH=main

echo "-> Updating from origin/$BRANCH"
git pull --rebase --autostash origin "$BRANCH"

echo "-> Building generated data"
python3 scripts/site.py build

echo "-> Validating site"
python3 scripts/site.py check

echo "-> Staging changes"
git add -A

if git diff --cached --quiet; then
  echo "No changes to commit."
  exit 0
fi

git status --short
git commit -m "$MSG"

if [[ $NOPUSH -eq 0 ]]; then
  echo "-> Pushing origin/$BRANCH"
  git push origin "$BRANCH"
else
  echo "-> Push skipped (--no-push)"
fi
