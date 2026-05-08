#!/bin/bash
set -e
npm install
npm run db:push

bash "$(dirname "$0")/github-push.sh"
