# Existing Exercises

Complete list of all 41 exercises in Git Kata.

## Summary by Category

| Category | Count | Exercises |
|----------|-------|-----------|
| init | 4 | init-basic-01, init-config-01, git-clean-01, gitignore-01 |
| commit | 3 | commit-basic-01, commit-amend-01, commit-multiple-01 |
| branch | 6 | branch-basic-01, branch-delete-01, branch-list-01, checkout-basic-01, branch-create-switch-01, branch-rename-01 |
| merge | 3 | merge-basic-01, merge-conflict-01, merge-fast-forward-01 |
| stash | 4 | stash-basic-01, stash-pop-01, stash-apply-01, stash-with-message-01 |
| rebase | 2 | rebase-basic-01, rebase-interactive-01 |
| reset | 2 | reset-soft-01, discard-changes-01 |
| remote | 3 | remote-add-01, branch-force-01, git-push-01 |
| stage | 4 | stage-file-01, stage-file-02, unstage-file-01, diff-cached-01 |
| history | 6 | log-basic-01, diff-basic-01, show-basic-01, status-basic-01, untracked-vs-staged-01, log-oneline-graph-01 |
| advanced | 4 | bisect-basic-01, cherry-pick-01, reflog-01, tag-create-01 | |

## All Exercises

### Level 1 (Beginner)

| Exercise | Location | Title | Description |
|----------|----------|-------|-------------|
| commit-basic-01 | problems/commit-basic-01 | Commit Your First Change | Stage and commit the file "changes.txt" |
| commit-multiple-01 | problems/commit-multiple-01 | Commit Multiple Files | Stage and commit three files (feature1.txt, feature2.txt, feature3.txt) |
| diff-basic-01 | problems/diff-basic-01 | View File Changes | View unstaged changes in hello.txt using `git diff` |
| discard-changes-01 | problems/discard-changes-01 | Discard Unstaged Changes | Restore hello.txt to last committed version, discarding unstaged changes |
| git-clean-01 | problems/git-clean-01 | Remove Untracked Files | Remove untracked files (temp.txt, debug.log) from working directory |
| gitignore-01 | problems/gitignore-01 | Create a Gitignore File | Create .gitignore to ignore *.log files and node_modules/ |
| init-basic-01 | problems/init-basic-01 | Create Your First Repository | Initialize a new Git repository with `git init` |
| init-config-01 | problems/init-config-01 | Configure Git User | Set up Git identity (user.email, user.name) |
| log-basic-01 | problems/log-basic-01 | View Commit History | View the commit history with `git log` |
| show-basic-01 | problems/show-basic-01 | Show Commit Details | Display information about a commit using `git show` |
| stage-file-01 | problems/stage-file-01 | Stage a File | Stage hello.txt for commit |
| stage-file-02 | problems/stage-file-02 | Stage Multiple Files | Stage multiple files (file1.txt, file2.txt, file3.txt) |
| status-basic-01 | problems/status-basic-01 | Check Repository Status | View repository status with mixed staged, unstaged, and untracked files |
| unstage-file-01 | problems/unstage-file-01 | Unstage a File | Unstage hello.txt that was accidentally staged |
| untracked-vs-staged-01 | problems/untracked-vs-staged-01 | Understand Staged vs Unstaged vs Untracked | Identify and understand different change states in git |

### Level 2 (Basic)

| Exercise | Location | Title | Description |
|----------|----------|-------|-------------|
| branch-basic-01 | problems/branch-basic-01 | Create a Branch | Create a new branch called 'feature' from main |
| branch-create-switch-01 | problems/branch-create-switch-01 | Create and Switch to Branch | Create and switch to 'feature' branch in one command |
| branch-delete-01 | problems/branch-delete-01 | Delete a Branch | Delete the 'feature' branch after it's been merged |
| branch-list-01 | problems/branch-list-01 | List Branches | List all branches in the repository |
| branch-rename-01 | problems/branch-rename-01 | Rename a Branch | Rename branch 'fix' to 'bugfix' |
| checkout-basic-01 | problems/checkout-basic-01 | Switch Branches | Switch from main to the 'feature' branch |
| diff-cached-01 | problems/diff-cached-01 | Review Staged Changes | View staged changes before committing with `git diff --staged` |
| git-push-01 | problems/git-push-01 | Push Changes to Remote | Push commits to remote repository |
| log-oneline-graph-01 | problems/log-oneline-graph-01 | View Visual Commit History | View branch structure with `git log --oneline --graph` |
| merge-basic-01 | problems/merge-basic-01 | Merge a Feature Branch | Merge 'feature' branch (2 commits) into 'main' |
| merge-fast-forward-01 | problems/merge-fast-forward-01 | Fast-Forward Merge | Fast-forward merge of 'feature' into 'main' |
| remote-add-01 | problems/remote-add-01 | Add a Remote | Add bare repository as remote named "origin" |
| reset-soft-01 | problems/reset-soft-01 | Undo Last Commit (Soft) | Undo last commit with `git reset --soft` keeping changes staged |
| stash-basic-01 | problems/stash-basic-01 | Stash Your Changes | Stash uncommitted changes (modified app.js, new-feature.txt) |
| stash-pop-01 | problems/stash-pop-01 | Restore Stashed Changes | Restore previously stashed changes |
| stash-with-message-01 | problems/stash-with-message-01 | Stash with Message | Stash changes with descriptive message "work-in-progress-feature" |

### Level 3 (Intermediate)

| Exercise | Location | Title | Description |
|----------|----------|-------|-------------|
| cherry-pick-01 | problems/cherry-pick-01 | Cherry-Pick a Commit | Apply only the "Feature: add feature" commit from 'feature' branch onto 'main' |
| commit-amend-01 | problems/commit-amend-01 | Amend a Commit Message | Change commit message "asdf" to "Add hello.txt" |
| merge-conflict-01 | problems/merge-conflict-01 | Resolve a Merge Conflict | Resolve conflicting changes to the same file from 'main' and 'feature' branches |
| rebase-basic-01 | problems/rebase-basic-01 | Rebase a Branch | Rebase 'feature' branch onto current 'main' |
| rebase-interactive-01 | problems/rebase-interactive-01 | Squash Commits | Squash three WIP commits on 'feature' into one using interactive rebase |

### Level 4 (Advanced)

| Exercise | Location | Title | Description |
|----------|----------|-------|-------------|
| bisect-basic-01 | problems/bisect-basic-01 | Find a Bug with Git Bisect | Use `git bisect` to find the commit that introduced a bug in math.py |
| branch-force-01 | problems/branch-force-01 | Force Push Changes | Force push to remote after amending commits (diverged history) |
| reflog-01 | problems/reflog-01 | Recover Lost Commits | Find and recover commits lost after `git reset --hard HEAD~2` |
| stash-apply-01 | problems/stash-apply-01 | Apply Specific Stash | Apply a specific stash (stash@{1}) containing "feature B" |
| tag-create-01 | problems/tag-create-01 | Create and Use Tags | Create an annotated tag `v1.0.0` marking a release |

## Exercise Directory Structure

```
exercises/
├── problems/
│   ├── bisect-basic-01/
│   ├── branch-basic-01/
│   ├── branch-create-switch-01/
│   ├── branch-delete-01/
│   ├── branch-force-01/
│   ├── branch-list-01/
│   ├── branch-rename-01/
│   ├── checkout-basic-01/
│   ├── cherry-pick-01/
│   ├── commit-amend-01/
│   ├── commit-basic-01/
│   ├── commit-multiple-01/
│   ├── diff-basic-01/
│   ├── diff-cached-01/
│   ├── discard-changes-01/
│   ├── git-clean-01/
│   ├── git-push-01/
│   ├── gitignore-01/
│   ├── init-basic-01/
│   ├── init-config-01/
│   ├── log-basic-01/
│   ├── log-oneline-graph-01/
│   ├── merge-basic-01/
│   ├── merge-conflict-01/
│   ├── merge-fast-forward-01/
│   ├── rebase-basic-01/
│   ├── rebase-interactive-01/
│   ├── reflog-01/
│   ├── remote-add-01/
│   ├── reset-soft-01/
│   ├── show-basic-01/
│   ├── stage-file-01/
│   ├── stage-file-02/
│   ├── stash-apply-01/
│   ├── stash-basic-01/
│   ├── stash-pop-01/
│   ├── stash-with-message-01/
│   ├── status-basic-01/
│   ├── tag-create-01/
│   ├── unstage-file-01/
│   └── untracked-vs-staged-01/
└── solutions/
    └── (same 41 exercise directories)
```

Each exercise directory contains:
- `spec.yaml` - Exercise metadata
- `content/` - Git repository (problem: starting state, solution: reference solution)