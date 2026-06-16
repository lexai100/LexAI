#!/usr/bin/env bash
# push_all.sh — Push LexAI to all 3 GitHub remotes
# Run this from the repo root: bash push_all.sh
# You will be prompted for your GitHub username + Personal Access Token (PAT)
# OR set GH_TOKEN env var: GH_TOKEN=ghp_xxx bash push_all.sh

set -e

REPO_DIR="$(dirname "$0")"
cd "$REPO_DIR"

REMOTES=(
  "origin   https://github.com/lexai100/LexAI.git       (account: lexai100)"
  "anonyx   https://github.com/Anonyx-Byte/LexAI.git    (account: Anonyx-Byte)"
  "harshini https://github.com/harshini124-in/LexAI.git (account: harshini124-in)"
)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  LexAI — Push to all 3 GitHub remotes"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Latest commit:"
git log --oneline -1
echo ""

push_remote() {
  local remote=$1
  local url=$2
  local label=$3

  echo "→ Pushing to $remote ($label)..."

  if [ -n "$GH_TOKEN" ]; then
    # Extract base URL and inject token
    local auth_url="${url/https:\/\//https:\/\/${GH_TOKEN}@}"
    git push "$auth_url" main && echo "  ✅ $remote — done" || echo "  ❌ $remote — failed (check token/access)"
  else
    git push "$remote" main && echo "  ✅ $remote — done" || echo "  ❌ $remote — failed (set up credentials)"
  fi
  echo ""
}

push_remote "origin"   "https://github.com/lexai100/LexAI.git"       "lexai100"
push_remote "anonyx"   "https://github.com/Anonyx-Byte/LexAI.git"    "Anonyx-Byte"
push_remote "harshini" "https://github.com/harshini124-in/LexAI.git" "harshini124-in"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  All pushes attempted."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
