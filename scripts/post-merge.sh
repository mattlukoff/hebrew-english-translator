#!/bin/bash
set -e
npm install
npm run db:push

if [ -z "$GITHUB_TOKEN" ]; then
  echo "Warning: GITHUB_TOKEN not set, skipping GitHub push."
  exit 0
fi

echo "Pushing to GitHub..."

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

GIT_ASKPASS="$ASKPASS_SCRIPT" git push github HEAD:main
echo "Successfully pushed to GitHub."
