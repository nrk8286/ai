#!/usr/bin/env bash
set -euo pipefail

# Usage: ./remove_env_history.sh <branch-to-push-to>
# Example: ./remove_env_history.sh security/remove-env-2025-09-07

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <target-branch>"
  exit 2
fi

TARGET_BRANCH="$1"

echo "Ensure you are on the branch you want to clean (e.g. main)."
read -p "Proceed (type 'yes' to continue)? " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted by user."
  exit 1
fi

# 1) Ensure working tree is clean
git status --porcelain
if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree not clean. Commit or stash changes first."
  exit 1
fi

# 2) Create a temporary branch from current HEAD
git checkout -B tmp/remove-env-clean

# 3) Remove .env from the index (so subsequent commit doesn't include it)
git rm --cached -f .env || true
# Make sure .env is ignored
if ! grep -q "^\.env$" .gitignore 2>/dev/null; then
  printf "\n.env\n" >> .gitignore
  git add .gitignore
  git commit -m "chore: add .env to .gitignore"
fi

# 4) Rewrite history to remove .env blobs (preferred: git-filter-repo)
if command -v git-filter-repo >/dev/null 2>&1; then
  echo "Using git-filter-repo to remove .env from history..."
  git filter-repo --invert-paths --paths .env
else
  echo "git-filter-repo not found. Please install it (https://github.com/newren/git-filter-repo)."
  echo "Alternative: use BFG Repo-Cleaner. See instructions below."
  cat <<'BFG_NOTE'
BFG alternative:
1. git clone --mirror git@github.com:youruser/yourrepo.git
2. java -jar bfg.jar --delete-files .env yourrepo.git
3. cd yourrepo.git
4. git reflog expire --expire=now --all && git gc --prune=now --aggressive
5. git push --force
BFG: https://rtyley.github.io/bfg-repo-cleaner/
BFG_NOTE
  exit 1
fi

# 5) Create the branch to push cleaned history and force-push
git checkout -B "$TARGET_BRANCH"
git push origin --force "$TARGET_BRANCH"

echo "History rewrite complete and force-pushed to origin/${TARGET_BRANCH}."
echo "Next: rotate any credentials that were present in the removed .env (see checklist)."