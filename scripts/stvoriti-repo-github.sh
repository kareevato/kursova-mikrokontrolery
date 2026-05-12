#!/usr/bin/env bash
# Створює НОВИЙ репозиторій на GitHub і робить push поточного проєкту.
# Перед запуском ОБОВ’ЯЗКОВО: gh auth login

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! gh auth status &>/dev/null; then
  echo "Ви ще не увійшли в GitHub CLI."
  echo "Виконайте в терміналі (один раз):"
  echo "  gh auth login"
  echo "Оберіть: GitHub.com → HTTPS → Yes → Login with a web browser."
  exit 1
fi

LOGIN="$(gh api user -q .login)"
DEFAULT_NAME="kursova-esp32-light"
REPO_NAME="${1:-$DEFAULT_NAME}"

if git remote get-url origin &>/dev/null; then
  echo "Уже є remote origin. Видаліть або змініть:"
  echo "  git remote remove origin"
  exit 1
fi

echo "Створюю репозиторій: $LOGIN/$REPO_NAME"
gh repo create "$REPO_NAME" --public --source=. --remote=origin --push --description "Курсова: ESP32, Node.js, SQLite, веб-монітор освітленості"

echo ""
echo "Готово. Відкрийте:"
echo "  https://github.com/$LOGIN/$REPO_NAME"
