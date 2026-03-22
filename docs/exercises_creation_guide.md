# Exercise Creation Guide

This guide describes how to create a properly formatted Git Kata exercise.

## Directory Structure

Each exercise requires two directories:

```
exercises/
├── problems/{exercise-name}/
│   ├── content/           # Git repository with starting state
│   │   └── (git repo files)
│   └── spec.yaml         # Exercise metadata
└── solutions/{exercise-name}/
    ├── content/          # Reference solution Git repository
    └── verify.sh         # Validation script
```

### 1. Problem Directory (`problems/{exercise-name}/`)

Contains the initial state a user receives when starting the exercise.

#### `content/` - Starting Git Repository

**Must be a fully initialized Git repository.** This is what gets copied to the user's sandbox when they start the exercise.

```bash
cd exercises/problems/{exercise-name}/content
git init
git config user.email "kata@gitkata.com"
git config user.name "Git Kata"
git commit -m "Initial commit"
# Add any additional setup commits, branches, files, etc.
```

**Important requirements:**
- Always configure git user (user.email, user.name) before committing
- The repository should have at least one commit
- Create the exact file state the user needs to work with
- If the exercise involves staged/unstaged/untracked states, set those up accordingly
- For exercises involving branches, create those branches in the repo

#### `spec.yaml` - Exercise Metadata

```yaml
name: exercise-name          # Must match directory name
title: Display Title         # Human-readable title
level: 1                     # Difficulty: 1, 2, 3, or 4
category: category-name      # init, commit, branch, merge, stash, rebase, reset, remote, stage, history, advanced
timeLimit: 300               # Time limit in seconds (default 600)
description: |               # Markdown description of the task
  Multi-line description
  of what the user needs to do.
  Do NOT include hints here - use the hint field below.
hint: |                      # Optional hint shown only when user clicks "View Solution"
  Optional hint text.
initialBranch: main          # Which branch user starts on (null for init exercises)
```

**Fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Must exactly match the directory name |
| `title` | Yes | Human-readable title shown in UI |
| `level` | Yes | 1 (beginner) to 4 (advanced) |
| `category` | Yes | Groups exercises in UI |
| `timeLimit` | No | Seconds, default 600 |
| `description` | Yes | Task description in markdown |
| `hint` | No | Shown when user requests solution |
| `initialBranch` | No | Branch user starts on (null for init) |

### 2. Solution Directory (`solutions/{exercise-name}/`)

Contains the reference solution and verification script.

#### `content/` - Reference Solution Repository

**Must be a fully initialized Git repository** containing the correct solution state after the exercise is completed.

```bash
# Copy problem content as starting point
cp -r ../../problems/{exercise-name}/content .
# Configure git user
git config user.email "kata@gitkata.com"
git config user.name "Git Kata"
# Apply the solution changes (this varies by exercise type)
# For example, if solution is to create a branch:
git checkout -b feature
# Or if solution is to unstage a file:
git reset HEAD hello.txt
# Or if solution is to discard changes:
git checkout -- hello.txt
# Commit the solution state
git commit -am "Solution"
```

**Important requirements:**
- Start by copying the problem content: `cp -r ../../problems/{exercise-name}/content .`
- Always configure git user before committing
- Apply exactly the operations that represent a correct solution
- Commit the solution state so the verify.sh can compare against it

#### `verify.sh` - Validation Script

The script that verifies a user's attempt is correct.

```bash
#!/bin/bash
# verify.sh for exercise-name
# Usage: verify.sh <user_workspace> <canonical_solution>

USER_DIR="$1"
SOLUTION_DIR="$2"

echo "VERIFICATION_START"
echo ""

# Perform checks, output PASS: or FAIL: for each
echo "Checking something..."
if some_condition; then
  echo "PASS: description of success"
else
  echo "FAIL: description of failure"
fi

echo ""
echo "VERIFICATION_END"
```

**Requirements:**

- Must start with `#!/bin/bash`
- Must accept two arguments: `USER_DIR` and `SOLUTION_DIR`
- Must output `VERIFICATION_START` at start and `VERIFICATION_END` at end
- Must output `PASS:` or `FAIL:` lines for each check
- Runs in web-app context (not sandbox) for security isolation
- Use `git -C "$USER_DIR"` to run git commands in user's workspace
- Natural language output (not structured data)

## Categories

Use one of these categories:

| Category | Description |
|----------|-------------|
| `init` | Repository initialization |
| `commit` | Committing changes |
| `branch` | Branch creation/deletion/switching |
| `merge` | Merging branches |
| `stash` | Stashing changes |
| `rebase` | Rebasing branches |
| `reset` | Resetting HEAD |
| `remote` | Working with remotes |
| `stage` | Staging files |
| `history` | Viewing history (log, diff, show) |
| `advanced` | Bisect, reflog, cherry-pick, tags |

## Difficulty Levels

| Level | Description |
|-------|-------------|
| 1 | Beginner - single command, no git concepts |
| 2 | Basic - multiple steps, basic git understanding |
| 3 | Intermediate - complex operations, conflict resolution |
| 4 | Advanced - multi-step workflows, recovery scenarios |

## Example: Creating `my-exercise-01`

1. **Create problem directory:**
   ```bash
   mkdir -p exercises/problems/my-exercise-01/content
   ```

2. **Initialize git repo in content:**
   ```bash
   cd exercises/problems/my-exercise-01/content
   git init
   git commit --allow-empty -m "Initial commit"
   ```

3. **Create spec.yaml:**
   ```yaml
   name: my-exercise-01
   title: My Exercise
   level: 2
   category: branch
   timeLimit: 300
   description: |
     Create a new branch called 'feature'.
   hint: |
     Use `git branch feature` to create the branch.
   initialBranch: main
   ```

4. **Create solution directory:**
   ```bash
   mkdir -p exercises/solutions/my-exercise-01/content
   ```

5. **Set up solution repo:**
   ```bash
   cp -r ../../problems/my-exercise-01/content .
   git checkout -b feature
   git commit --allow-empty -m "Create feature branch"
   ```

6. **Create verify.sh:**
   ```bash
   #!/bin/bash
   USER_DIR="$1"
   SOLUTION_DIR="$2"

   echo "VERIFICATION_START"
   echo ""

   if git -C "$USER_DIR" rev-parse --verify feature >/dev/null 2>&1; then
     echo "PASS: feature branch exists"
   else
     echo "FAIL: feature branch not found"
   fi

   echo ""
   echo "VERIFICATION_END"
   ```

7. **Index exercise in database:**
   ```bash
   npm run scan-exercises
   ```

## Validation

After creating an exercise:

1. Run `npm run scan-exercises` to index it in the database
2. Start the app and verify the exercise appears in the list
3. Attempt the exercise and ensure `verify.sh` correctly validates success/failure
4. Check that the hint is only shown when requested

## Remote Exercises (Git Server)

Exercises involving remote repositories (push, pull, clone) require special setup because they need a git server.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Git Server (git-server)                   │
│  - Runs git-daemon on port 9418                            │
│  - Uses host network (network_mode: host)                   │
│  - Serves bare repos from /repos volume                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ git:// protocol
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Sandbox Containers                         │
│  - Use --network host to access git-server                  │
│  - git://localhost:9418/repo.git to connect                 │
└─────────────────────────────────────────────────────────────┘
```

### Creating a Remote Exercise

Remote exercises require:

1. **A bare repository** on the git server
2. **Content directory** with a cloned repo pointing to the remote
3. **verify.sh** that validates the push/pull operation

### Example: git-push-01

Directory structure:
```
exercises/problems/git-push-01/
├── content/           # Cloned repo with remote origin configured
│   ├── .git/
│   ├── hello.txt
│   └── (remote already set to bundled .remote-origin)
├── .remote-origin/   # Bare repo acting as remote (bundled)
├── remote.git/        # Another bare repo option
└── spec.yaml
```

### Important Notes

- **Sandbox network mode**: Currently uses `--network host` for git access
- **git:// protocol**: Currently used for remote operations (no authentication)
- **Port**: Git daemon runs on port 9418
- **Volume**: Repos are stored in Docker volume `git-repos` mounted at `/repos`

### verify.sh for Remote Exercises

```bash
#!/bin/bash
USER_DIR="$1"
SOLUTION_DIR="$2"

echo "VERIFICATION_START"
echo ""

# For exercises with bundled remote.git:
# Access the bundled remote directly (it's not in user's workspace)
PROBLEM_DIR="$(dirname "$SOLUTION_DIR")/../../problems/git-push-01"
REMOTE_GIT="$PROBLEM_DIR/remote.git"

# Check if push succeeded by comparing hashes
REMOTE_HASH=$(git --git-dir="$REMOTE_GIT" rev-parse main)
LOCAL_HASH=$(git -C "$USER_DIR" rev-parse HEAD)

if [ "$REMOTE_HASH" = "$LOCAL_HASH" ]; then
    echo "PASS: Remote updated successfully"
else
    echo "FAIL: Remote not updated - did you push?"
fi

echo ""
echo "VERIFICATION_END"
```

### Infrastructure Files

| File | Purpose |
|------|---------|
| `git-server/Dockerfile` | Docker image for git-daemon server |
| `docker-compose.yaml` | Defines git-server service |
| `lib/sandbox.ts` | Helper functions: `createBareRepo()`, `getGitUrl()`, `cloneFromGitServer()` |
| `lib/container-pool.ts` | Uses `--network host` for sandbox containers |

### Future Improvements

- SSH-based git access (more secure)
- Per-exercise isolated git servers
- Automatic repo creation on exercise start
- Network isolation with firewall rules