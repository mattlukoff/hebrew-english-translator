#!/bin/bash
set -e
npm install
npm run db:push

if [ -n "$GITHUB_TOKEN" ]; then
  echo "Pushing to GitHub..."
  git remote remove github 2>/dev/null || true
  git remote add github "https://mattlukoff:${GITHUB_TOKEN}@github.com/mattlukoff/hebrew-english-translator.git"
  git push github HEAD:main --force
  git remote remove github
  echo "Successfully pushed to GitHub."
else
  echo "Warning: GITHUB_TOKEN not set, skipping GitHub push."
fi
