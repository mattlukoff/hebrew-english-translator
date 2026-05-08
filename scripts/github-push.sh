#!/bin/bash
# Push current HEAD to GitHub.
# Called by scripts/post-merge.sh after every Replit task merge.
# In Replit's task-based workflow, every code change is committed via a task
# merge, making the postMerge hook the correct commit-triggered sync point.

if [ -z "$GITHUB_TOKEN" ]; then
  echo "[github-sync] ERROR: GITHUB_TOKEN secret is not set." >&2
  echo "[github-sync] Set it in Replit Secrets (repo-scoped PAT for mattlukoff)." >&2
  exit 1
fi

ASKPASS_SCRIPT=$(mktemp)
chmod 700 "$ASKPASS_SCRIPT"
printf '#!/bin/sh\necho "%s"\n' "$GITHUB_TOKEN" > "$ASKPASS_SCRIPT"

cleanup() {
  rm -f "$ASKPASS_SCRIPT"
  git remote remove github 2>/dev/null || true
}
trap cleanup EXIT

git remote remove github 2>/dev/null || true
git remote add github "https://mattlukoff@github.com/mattlukoff/hebrew-english-translator.git"

echo "[github-sync] Pushing to GitHub..."
if GIT_ASKPASS="$ASKPASS_SCRIPT" git push github HEAD:main; then
  echo "[github-sync] Successfully pushed to GitHub."
else
  echo "[github-sync] ERROR: Push to GitHub failed. Check GITHUB_TOKEN validity." >&2
  exit 1
fi
