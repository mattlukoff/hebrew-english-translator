#!/bin/bash
set -e
npm install
npm run db:push

if [ -n "$GITHUB_TOKEN" ]; then
  echo "Pushing to GitHub..."

  git config --global credential.helper store
  printf "https://mattlukoff:%s@github.com\n" "$GITHUB_TOKEN" > ~/.git-credentials
  chmod 600 ~/.git-credentials

  git remote remove github 2>/dev/null || true
  git remote add github "https://github.com/mattlukoff/hebrew-english-translator.git"

  if git push github HEAD:main; then
    echo "Successfully pushed to GitHub."
  else
    echo "Fast-forward push failed (histories may have diverged). Attempting reconciled push..."
    git fetch github main
    git push github HEAD:main --force-with-lease
    echo "Successfully pushed to GitHub (force-with-lease)."
  fi

  git remote remove github
  rm -f ~/.git-credentials
  git config --global --unset credential.helper || true
else
  echo "Warning: GITHUB_TOKEN not set, skipping GitHub push."
  exit 1
fi
