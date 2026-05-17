#!/bin/bash
MESSAGE=${1:-"chore: update"}
cd /home/developer/glremit/golink-remit
git add -A
git commit -m "$MESSAGE" 2>/dev/null || echo "Nothing new to commit"
BRANCH=$(git branch --show-current)
GIT_TERMINAL_PROMPT=1 GIT_ASKPASS="" git push --set-upstream origin $BRANCH
echo "✅ Pushed: $MESSAGE (branch: $BRANCH)"
