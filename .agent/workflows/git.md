---
description: Push code changes to GitHub repository
---

# Git Push Workflow

Push local changes to the GitHub repository.

## Prerequisites
- Git must be initialized in the project
- Remote origin must be configured: `https://github.com/Vieeeeeee/DESIGN-INFINITE.git`

## Steps

// turbo
1. Check current git status
```bash
git status
```

// turbo
2. Add all changes to staging
```bash
git add .
```

3. Commit changes with a descriptive message
```bash
git commit -m "描述你的更改"
```

// turbo
4. Push to GitHub
```bash
git push origin main
```

## Quick Push (All-in-One)

For quick pushes, you can combine steps:
```bash
git add . && git commit -m "Update: 描述更改" && git push origin main
```

## First Time Setup (If Not Initialized)

If the repository is not yet initialized:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/Vieeeeeee/DESIGN-INFINITE.git
git branch -M main
git push -u origin main
```

## Common Commands

- View commit history: `git log --oneline -10`
- Check remote: `git remote -v`
- Pull latest changes: `git pull origin main`
- Discard local changes: `git checkout -- .`
- View diff: `git diff`
