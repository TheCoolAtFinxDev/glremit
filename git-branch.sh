#!/bin/bash
BRANCH=${1:-"feature/new"}
cd /home/developer/glremit/golink-remit
git checkout -b "$BRANCH"
echo "✅ On branch: $BRANCH"
