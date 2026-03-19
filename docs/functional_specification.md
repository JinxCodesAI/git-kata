# Git Kata - Functional Specification

## 1. Overview

### 1.1 Purpose
Git Kata is a web-based application for practicing Git commands through structured exercises (kata). Users receive real-time feedback on their attempts, with LLM-powered evaluation of their solutions.

### 1.2 Target Users
- Software developers learning Git
- Students in programming courses
- Teams onboarding new members to Git workflows
- Anyone wanting to practice Git commands in a safe environment

### 1.3 Core Principles
- **Safety**: All git operations run in isolated containers
- **Simplicity**: Clean, distraction-free interface
- **Authenticity**: Real git commands, not simulations
- **Progressive Learning**: Exercises organized by difficulty level

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Browser                             │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Terminal UI (textbox + history)                            ││
│  │  Exercise Instructions                                      ││
│  │  Feedback Display                                           ││
│  └─────────────────────────────────────────────────────────────┘│
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP/WebSocket
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Web App (Next.js)                          │
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
│ │ Pages │ │ API Routes │ │ Lib │ │
│ │ - Landing │ │ - /exercises │ │ - sandbox.ts │ │
│ │ - Challenge │ │ - /attempt │ │ - minimax.ts │ │
│ │ - Profile │ │ - /sandbox/* │ │ - prisma.ts │ │
│ │ - Leaderboard │ │ - /profile │ │ - exercise-loader.ts│ │
│ └─────────────────┘ └─────────────────┘ └─────────────────┘ │
└────────┬──────────────────────────┬─────────────────────────────┘
 │ │
 │ Docker Socket │ Prisma
 ▼ ▼
┌─────────────────────┐ ┌─────────────────────┐
│ Sandbox Manager │ │ PostgreSQL │
│ (Docker API) │ │ (Database) │
│ │ │ │
│ - Creates isolated │ │ - Users │
│ containers │ │ - Exercises (index) │
│ - Copies exercise │ │ - Attempts │
│ repos to sandbox │ │ - Scores │
│ - Executes git │ │ │
│ commands │ │ │
│ - Manages sessions │ │ │
└─────────────────────┘ └─────────────────────┘
 │ ▲
 │ │
 ▼ │
┌─────────────────────┐ │
│ Sandbox Container │ │
│ (Alpine + Git) │ │
│ │ │
│ Per-user isolated │ │
│ git environment │ │
└─────────────────────┘ │
 │
┌─────────────────────┐ │
│ Exercise Repository │──────────────────────┘
│ (Filesystem) │
│ │
│ - problems/[name]/ │
│ - solutions/[name]/ │
│ - spec.yaml files │
└─────────────────────┘
```

### 2.2 Container Architecture

| Container | Base Image | Purpose | Port |
|-----------|------------|---------|------|
| web-app | node:20-alpine | Next.js application | 12000:3000 |
| db | postgres:15-alpine | PostgreSQL database | 5432 (internal) |
| sandbox-* | alpine:3.19 + git | User git sessions | dynamic (auto-spawned) |

### 2.3 Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                     Exercise Flow                                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ 1. User selects exercise │
│ └─▶ Frontend calls POST /api/sandbox/create │
│ └─▶ Backend reads spec.yaml from exercise folder │
│ └─▶ Backend creates session folder │
│ └─▶ Backend copies exercise repo from filesystem to session folder │
│ └─▶ Backend spawns sandbox container with volume mount │
│ └─▶ Return sessionId to frontend │
│                                                                  │
│  2. User types git command                                       │
│     └─▶ Frontend sends to POST /api/sandbox/exec                 │
│         └─▶ Backend executes: docker exec {sid} git {cmd}        │
│         └─▶ Capture stdout/stderr                                │
│         └─▶ Return output to frontend                            │
│                                                                  │
│  3. User submits solution                                        │
│     └─▶ Frontend calls POST /api/attempt                         │
│         └─▶ Backend runs verify.sh from solution folder          │
│         └─▶ verify.sh compares user workspace to canonical solution│
│         └─▶ verify.sh outputs natural language report            │
│         └─▶ Backend sends verification report to MiniMax LLM      │
│         └─▶ LLM returns: passed, score, feedback                 │
│         └─▶ Store attempt in database                            │
│         └─▶ Return evaluation to frontend                        │
│                                                                  │
│ 4. Session cleanup (15 min inactivity or explicit exit)         │
│     └─▶ Backend kills and removes container                      │
│     └─▶ Backend removes session folder                           │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. User Interface

### 3.1 Design Aesthetic

**Theme: Matrix (1999) + Linux Terminal**

- Color palette:
  - Background: #0a0a0a (near black)
  - Primary text: #00ff41 (matrix green)
  - Secondary text: #008f11 (dim green)
  - Emphasis: #ffffff (white)
  - Error: #ff0040 (red)
  
- Typography:
  - Font: Monaco, Menlo, Ubuntu Mono, monospace
  - No gradients, no transparency, no blur effects
  
- Visual elements:
  - ASCII art headers
  - Terminal-style borders
  - Command-line aesthetic throughout

### 3.2 Pages

#### 3.2.1 Landing Page (`/`)

```
┌──────────────────────────────────────────────────────────────────┐
│  GIT-KATA v0.1.0                              user: anonymous   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  > START CHALLENGE                                              │
│                                                                  │
│  [1] BEGINNER     [2] INTERMEDIATE                             │
│  [3] ADVANCED     [4] EXPERT                                   │
│                                                                  │
│                                                                  │
│  > PROFILE         > LEADERBOARD                                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Elements:**
- Header with app name, version badge, and user identifier
- Start Challenge section with 4 difficulty buttons
- Navigation links to Profile and Leaderboard

#### 3.2.2 Challenge Page (`/challenge/[id]`)

```
┌──────────────────────────────────────────────────────────────────┐
│ git-kata > challenge > merge-basic-01                    [exit] │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ EXERCISE: Merge a Feature Branch                                 │
│ Level: 2 (Intermediate)                                          │
│ Time: 05:32 / 10:00                                             │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────────┐
│ │ INSTRUCTIONS                                                   │
│ │ ─────────────────────────────────────────────────────────────  │
│ │ You have a 'feature' branch with 2 new commits.               │
│ │ Merge it into 'main' branch.                                  │
│ │                                                                │
│ │ Hint: Switch to main first, then merge.                       │
│ │                                                                │
│ │ Current branches:                                             │
│ │   * feature                                                   │
│ │     main                                                      │
│ └────────────────────────────────────────────────────────────────┘
│
│ ┌────────────────────────────────────────────────────────────────┐
│ │ TERMINAL HISTORY                                               │
│ │ ─────────────────────────────────────────────────────────────  │
│ │ $ git checkout main                                           │
│ │ Switched to branch 'main'                                     │
│ │ $ git merge feature                                           │
│ │ Updating a1b2c3d..e4f5g6h                                     │
│ │ Fast-forward                                                  │
│ │  feature.txt | 2 ++                                           │
│ │  1 file changed, 2 insertions(+)                             │
│ └────────────────────────────────────────────────────────────────┘
│
│ ┌────────────────────────────────────────────────────────────────┐
│ │ $ █                                                            │
│ └────────────────────────────────────────────────────────────────┘
│
│ [Submit Solution]  [Reset Exercise]  [Skip]                     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Elements:**
- Header with exercise name and exit button
- Timer display (elapsed / limit)
- Instructions panel (markdown rendered)
- Terminal history (scrollable, shows all commands and output)
- Command input (single line textbox)
- Action buttons: Submit, Reset, Skip

#### 3.2.3 Profile Page (`/profile`)

```
┌──────────────────────────────────────────────────────────────────┐
│ git-kata > profile                                       [home] │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ USER: anonymous_7f3a9b                                          │
│ Joined: 2024-01-15                                              │
│ Last active: 2024-01-20                                         │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────────┐
│ │ STATISTICS                                                     │
│ │ ─────────────────────────────────────────────────────────────  │
│ │ Total Exercises: 24/40                                        │
│ │ Total Score:    1840/4000                                     │
│ │ Average Score:  76.7%                                         │
│ │ Best Streak:    8                                             │
│ └────────────────────────────────────────────────────────────────┘
│
│ ┌────────────────────────────────────────────────────────────────┐
│ │ PROGRESS BY LEVEL                                              │
│ │ ─────────────────────────────────────────────────────────────  │
│ │                                                                │
│ │ [1] BEGINNER     ████████████████████░░░░  8/10 (80%)        │
│ │ [2] INTERMEDIATE ████████████░░░░░░░░░░░░  6/10 (60%)        │
│ │ [3] ADVANCED     ████████░░░░░░░░░░░░░░░░  4/10 (40%)        │
│ │ [4] EXPERT       ██████░░░░░░░░░░░░░░░░░░  3/10 (30%)        │
│ │                                                                │
│ └────────────────────────────────────────────────────────────────┘
│
│ ┌────────────────────────────────────────────────────────────────┐
│ │ RECENT ATTEMPTS                                                │
│ │ ─────────────────────────────────────────────────────────────  │
│ │ merge-basic-01    [PASS] 85%   2024-01-20 14:32               │
│ │ branch-create-03  [PASS] 92%   2024-01-20 14:28               │
│ │ rebase-conflict-02[FAIL] 45%   2024-01-20 14:15               │
│ │ stash-basic-01    [PASS] 78%   2024-01-20 13:55               │
│ │ commit-amend-02   [PASS] 88%   2024-01-20 13:42               │
│ └────────────────────────────────────────────────────────────────┘
│
└──────────────────────────────────────────────────────────────────┘
```

**Elements:**
- User info section
- Statistics summary
- Progress bars by level
- Recent attempts list

#### 3.2.4 Leaderboard Page (`/leaderboard`)

```
┌──────────────────────────────────────────────────────────────────┐
│ git-kata > leaderboard                                   [home] │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌────────────────────────────────────────────────────────────────┐
│ │ LEADERBOARD                                                    │
│ │ ─────────────────────────────────────────────────────────────  │
│ │                                                                │
│ │ RANK  USER              SCORE    EXERCISES   AVG.TIME         │
│ │ ────  ────              ─────    ─────────   ────────         │
│ │   1   git_master_42     3845     38/40       4m 23s           │
│ │   2   command_line_king 3612     36/40       5m 12s           │
│ │   3   branch_wizard     3420     34/40       6m 45s           │
│ │   4   merge_ninja       3150     32/40       5m 58s           │
│ │   5   commit_pro        2980     30/40       7m 15s           │
│ │ ...                                                            │
│ │  42   anonymous_7f3a9b  1840     24/40       8m 32s           │
│ │ ...                                                            │
│ │                                                                │
│ └────────────────────────────────────────────────────────────────┘
│
│ [Show All]  [My Position]                                       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Elements:**
- Ranked user list
- Score, completion count, average time
- Current user highlighted
- Filter/sort options

### 3.3 Feedback Modal

Appears after submitting a solution:

```
┌──────────────────────────────────────────────────────────────────┐
│ EVALUATION RESULT                                        [✕]   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│                    ██████╗  █████╗ ███╗   ██╗                    │
│                    ██╔══██╗██╔══██╗████╗  ██║                    │
│                    ██║  ██║███████║██╔██╗ ██║                    │
│                    ██║  ██║██╔══██║██║╚██╗██║                    │
│                    ██████╔╝██║  ██║██║ ╚████║                    │
│                    ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝                    │
│                                                                  │
│ SCORE: 85/100                                                   │
│ TIME:  3m 42s                                                   │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────────┐
│ │ FEEDBACK                                                       │
│ │ ─────────────────────────────────────────────────────────────  │
│ │                                                                │
│ │ Great work! You successfully merged the feature branch.       │
│ │                                                                │
│ │ You used the correct sequence:                                │
│ │ 1. Switched to main branch                                    │
│ │ 2. Merged feature branch                                      │
│ │                                                                │
│ │ Minor improvements:                                           │
│ │ - You could use 'git switch main' (modern alternative)        │
│ │ - Consider checking git status before merge                   │
│ │                                                                │
│ │ Points deducted for:                                          │
│ │ - Not verifying the merge result (-10)                        │
│ │ - Could have used --no-ff for explicit merge commit (-5)      │
│ │                                                                │
│ └────────────────────────────────────────────────────────────────┘
│
│ [Try Again]  [Next Exercise]  [View Solution]                   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Elements:**
- ASCII art result (PASS/FAIL)
- Score and time
- Detailed LLM feedback
- Action buttons

---

## 4. Functional Requirements

### 4.1 User Management

| ID | Requirement | Priority |
|----|-------------|----------|
| UM-01 | System shall create anonymous user on first visit (localStorage UUID) | High |
| UM-02 | System shall persist user ID across sessions via localStorage | High |
| UM-03 | System shall track user progress and scores | High |
| UM-04 | System shall allow user to view their profile statistics | Medium |

### 4.2 Exercise Management

| ID | Requirement | Priority |
|----|-------------|----------|
| EX-01 | System shall provide exercises organized by 4 difficulty levels | High |
| EX-02 | System shall categorize exercises by topic (branching, merging, etc.) | Medium |
| EX-03 | System shall load exercise content from filesystem repositories | High |
| EX-04 | System shall display exercise instructions from spec.yaml in markdown format | High |
| EX-05 | System shall track time spent on each exercise | High |
| EX-06 | System shall enforce time limits per exercise | Medium |
| EX-07 | System shall allow user to reset exercise to initial state (re-copy from source) | High |
| EX-08 | System shall allow user to skip exercises | Low |
| EX-09 | System shall scan exercises directory on startup and index available exercises | High |

### 4.3 Sandbox Environment

| ID | Requirement | Priority |
|----|-------------|----------|
| SB-01 | System shall create isolated git environment per user session | High |
| SB-02 | System shall initialize git repository with exercise-specific setup | High |
| SB-03 | System shall execute git commands in sandbox container | High |
| SB-04 | System shall capture command output (stdout/stderr) | High |
| SB-05 | System shall maintain terminal history during session | High |
| SB-06 | System shall destroy sandbox after 15 minutes inactivity | High |
| SB-07 | System shall apply resource limits to sandbox containers | High |
| SB-08 | System shall not allow network access from sandbox | High |

### 4.4 LLM Evaluation

| ID | Requirement | Priority |
|----|-------------|----------|
| LL-01 | System shall run verify.sh script to validate user solution | High |
| LL-02 | System shall send verify.sh output to MiniMax API for scoring | High |
| LL-03 | System shall receive structured evaluation (pass/fail, score, feedback) | High |
| LL-04 | System shall display feedback to user in readable format | High |
| LL-05 | System shall retry LLM API up to 3 times on failure; after retry limit is exhausted, return 500 error | Medium |
| LL-06 | Backend shall wait until LLM request completes or fails; UI shall display waiting indicator during evaluation | Medium |
| LL-07 | verify.sh output shall be natural language text for LLM interpretation | High |

### 4.5 Leaderboard

| ID | Requirement | Priority |
|----|-------------|----------|
| LB-01 | System shall rank users by total score | High |
| LB-02 | System shall display top 50 users by default | Medium |
| LB-03 | System shall highlight current user position | Medium |
| LB-04 | System shall allow viewing all participants | Low |

---

## 5. Exercise Levels and Categories

### 5.1 Level Definitions

| Level | Name | Focus | Prerequisites |
|-------|------|-------|---------------|
| 1 | Beginner | Basic operations, single commits | None |
| 2 | Intermediate | Branching, simple merges | Level 1 |
| 3 | Advanced | Conflicts, rebase, history manipulation | Level 2 |
| 4 | Expert | Complex workflows, debugging, automation | Level 3 |

### 5.2 Categories

| Category | Description | Example Exercises |
|----------|-------------|-------------------|
| `init` | Repository creation and configuration | Create repo, configure user, init .gitignore |
| `stage` | Staging area operations | Add files, partial staging, unstage |
| `commit` | Creating and modifying commits | Commit changes, amend, message conventions |
| `history` | Viewing and exploring history | Log, show, diff, blame |
| `branch` | Branch operations | Create, delete, rename branches |
| `merge` | Merging branches | Fast-forward, three-way, conflict resolution |
| `remote` | Remote repository operations | Clone, fetch, pull, push |
| `rebase` | Rebasing operations | Interactive rebase, onto, continue/abort |
| `reset` | Undoing changes | Soft, mixed, hard reset |
| `stash` | Temporarily saving changes | Stash, pop, apply, drop |
| `advanced` | Advanced operations | Cherry-pick, bisect, reflog, hooks |

### 5.3 Target Coverage

Goal: 80% of common Git operations covered

| Level | Exercise Count | Coverage Target |
|-------|----------------|-----------------|
| 1 | 10 | Basic workflow (init, add, commit, log) |
| 2 | 10 | Branching fundamentals |
| 3 | 10 | Conflict resolution, history rewriting |
| 4 | 10 | Advanced workflows |
| **Total** | **40** | **~80% of daily Git usage** |

---

## 6. Data Models

### 6.1 Entity Relationship Diagram

```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ User        │ │ Exercise    │ │ Attempt     │
├─────────────┤ ├─────────────┤ ├─────────────┤
│ id (PK)     │ │ id (PK)     │ │ id (PK)     │
│ name        │ │ level       │ │ userId (FK) │
│ createdAt   │◄──────│ category    │──────►│ exerciseId  │
│ lastActive  │ │ title       │ │ commands    │
│             │ │ path        │ │ output      │
│             │ │ timeLimit   │ │ passed      │
│             │ │ order       │ │ score       │
│             │ │             │ │ feedback    │
│             │ │             │ │ duration    │
└─────────────┘ └─────────────┘ │ createdAt   │
                                │             │
                                │ ┌─────────────┐
                                │ │ Score       │
                                │ ├─────────────┤
                                └──────────►│ id (PK)     │◄────────────┘
                                            │ userId (FK) │
                                            │ exerciseId  │
                                            │ bestScore   │
                                            │ completions │
                                            │ bestTime    │
                                            └─────────────┘
```

### 6.2 Field Specifications

#### User
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key, generated on first visit |
| name | String | Display name, default "anonymous_{uuid_prefix}" |
| createdAt | DateTime | Account creation timestamp |
| lastActive | DateTime | Last activity timestamp |

#### Exercise
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| level | Int | Difficulty level (1-4) |
| category | String | Category slug |
| title | String | Exercise title |
| path | String | Relative path to exercise folder (e.g., "problems/merge-basic-01") |
| timeLimit | Int | Time limit in seconds (default 600) |
| order | Int | Order within level/category |

Note: Description and validation logic are stored in filesystem. Description
comes from spec.yaml. Validation is performed by verify.sh in the corresponding
solution folder (see 6.3).

#### Attempt
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| userId | UUID | Foreign key to User |
| exerciseId | UUID | Foreign key to Exercise |
| commands | Text | JSON array of commands executed |
| output | Text | Terminal output log |
| passed | Boolean | Whether attempt passed evaluation |
| score | Int | Score 0-100 |
| feedback | Text | LLM evaluation feedback |
| duration | Int | Time spent in seconds |
| createdAt | DateTime | Attempt timestamp |

#### Score
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| userId | UUID | Foreign key to User |
| exerciseId | UUID | Foreign key to Exercise |
| bestScore | Int | Highest score achieved |
| completions | Int | Number of successful completions |
| bestTime | Int | Fastest completion time in seconds |

### 6.3 Exercise File Structure

Exercises are stored as actual Git repositories on disk, not as JSON in the database.

#### Directory Layout

```
exercises/
├── problems/
│   ├── merge-basic-01/
│   │   ├── content/           # Full git repository
│   │   │   ├── .git/          # Git metadata and history
│   │   │   ├── README.md      # Exercise files
│   │   │   └── ...            # Other files
│   │   └── spec.yaml          # Exercise metadata
│   ├── branch-create-01/
│   │   ├── content/
│   │   └── spec.yaml
│   └── ...
└── solutions/
    ├── merge-basic-01/
    │   ├── content/           # Reference solution repo (canonical state)
    │   │   ├── .git/
    │   │   └── ...
    │   └── verify.sh          # Validation script (natural language output)
    └── ...
```

#### verify.sh Script

Each solution folder contains a `verify.sh` script that validates whether the user correctly completed the exercise. The script:

- Receives two paths as arguments:
  - `$1`: User's workspace path (the working directory)
  - `$2`: Canonical solution path (the reference solution)
- Executes git commands to compare user state against expected state
- Outputs **natural language text** describing what checks passed/failed
- Does NOT output structured data (key=value) - LLM interprets the natural language

Example `verify.sh` for merge-basic-01:

```bash
#!/bin/bash
# verify.sh for merge-basic-01
# Usage: verify.sh <user_workspace> <canonical_solution>

USER_DIR="$1"
SOLUTION_DIR="$2"

echo "VERIFICATION_START"
echo ""

echo "Checking main branch contains all commits from feature branch..."
if git -C "$USER_DIR" log --oneline main | grep -q "Add feature"; then
  echo "PASS: main branch contains the feature commits"
else
  echo "FAIL: main branch is missing feature commits"
fi

echo ""
echo "Checking feature branch still exists..."
if git -C "$USER_DIR" rev-parse --verify feature >/dev/null 2>&1; then
  echo "PASS: feature branch still exists"
else
  echo "FAIL: feature branch was deleted"
fi

echo ""
echo "Checking for unmerged files..."
if [ -z "$(git -C "$USER_DIR" status --porcelain)" ]; then
  echo "PASS: no uncommitted or unmerged files"
else
  echo "FAIL: there are uncommitted changes"
fi

echo ""
echo "VERIFICATION_END"
```

**Key principles for verify.sh:**
1. Always outputs natural language, never structured data
2. Uses human-readable sentences like "PASS: ..." and "FAIL: ..."
3. Each check is independent and clearly labeled
4. Output is self-contained and requires no parsing
5. LLM reads the entire output and makes the final pass/fail decision

#### spec.yaml Format

```yaml
name: merge-basic-01
title: Merge a Feature Branch
level: 2
category: merge
timeLimit: 600
description: |
  You have a 'feature' branch with 2 new commits.
  Merge it into 'main' branch.
  
  Hint: Switch to main first, then merge.
initialBranch: feature  # Which branch to start on
```

Note: `validationHints` is no longer stored in spec.yaml. Validation logic is
encapsulated in `verify.sh` within the corresponding solution folder. This
allows for more complex, multi-step verification using git commands.

#### Benefits of File-Based Storage

1. **Authenticity**: Exercises are real git repos that can be inspected and tested locally
2. **Version Control**: Exercise content can be tracked in git alongside application code
3. **Ease of Creation**: Create new exercises by making a repo, not writing JSON
4. **Solution Verification**: Reference solutions exist as actual repos for comparison
5. **Simpler Database**: Only metadata indexed, no serialized git state

---

## 7. API Specification

### 7.1 Endpoints

#### Exercises

```
GET /api/exercises
Query: ?level=1&category=branch
Response: [{ id, level, category, title, completed? }]
Errors:
- 500: Internal server error

GET /api/exercises/[id]
Response: { id, level, category, title, description, timeLimit }
Errors:
- 404: Exercise not found
- 500: Internal server error
```

#### Sandbox

```
POST /api/sandbox/create
Body: { exerciseId, userId }
Response: { sessionId, containerName, expiresAt, exercise: {...} }
Errors:
- 400: Missing exerciseId or userId
- 404: Exercise not found
- 404: User not found
- 500: Failed to create sandbox

POST /api/sandbox/exec
Body: { sessionId, command }
Response: { output, exitCode }
Errors:
- 400: Missing sessionId or command
- 404: Session not found
- 500: Internal server error

Note: Commands that don't start with "git " are user input errors, not HTTP errors.
      The API returns 200 with an error message in the output field; the frontend
      displays this error to the user. This is correct behavior - it allows the user
      to see "Error: Only git commands are allowed" without breaking the session.

GET /api/sandbox/state/[sessionId]
Response: { branch, staged, unstaged, recentCommits }
Errors:
- 404: Session not found
- 500: Internal server error

DELETE /api/sandbox/[sessionId]
Response: { success: true }
Errors:
- 404: Session not found
- 500: Failed to destroy sandbox
```

#### Attempts

```
POST /api/attempt
Body: { sessionId, exerciseId, userId, duration }
Response: { passed, score, feedback, verificationOutput }

Fields:
- sessionId: string - the session ID returned from sandbox/create
- exerciseId: string - the exercise being attempted
- userId: string - the user ID (must match session owner)
- duration: number - time spent in seconds

Response Fields:
- passed: boolean - whether the solution passed evaluation
- score: number - 0-100 score
- feedback: string - LLM-generated feedback for the user
- verificationOutput: string - raw output from verify.sh (for debugging/auditing)

Errors:
- 400: Missing required fields
- 403: userId does not match session owner
- 404: session not found or exercise not found
- 500: evaluation failed after retry limit
```

#### Profile

```
GET /api/profile
Query: ?userId=<uuid> (optional - creates anonymous if missing)
Response: { user, stats, progressByLevel, recentAttempts }
Errors:
- 400: Invalid userId format
- 500: Internal server error
```

#### Leaderboard

```
GET /api/leaderboard
Query: ?limit=50&offset=0
Response: { entries: [{ rank, userId, name, score, exercises, avgTime }], totalParticipants }
Errors:
- 400: Invalid limit or offset
- 500: Internal server error
```

---

## 8. Security Requirements

### 8.1 Sandbox Isolation

| Requirement | Implementation |
|-------------|----------------|
| No network access | Sandbox container has no network interfaces |
| Filesystem isolation | Only /workspace mounted, read-only elsewhere |
| Resource limits | 256MB RAM, 50% CPU, 64 max processes |
| Time limits | 15 min session timeout, 10 min exercise limit |
| No privilege escalation | Non-root user in container, no sudo |

### 8.2 Input Validation

| Input | Validation |
|-------|------------|
| Git commands | Whitelist git commands only, no shell injection |
| User IDs | UUID format validation |
| Exercise IDs | UUID format validation |
| Session-User ownership | userId in request must match the userId who owns the session |

### 8.3 Data Protection

- No authentication required (anonymous users)
- User IDs stored in localStorage (client-side)
- No sensitive data in database
- LLM API key stored server-side only

### 8.4 Error Handling

#### MANDATORY: All Endpoints Must Handle Errors

**This section applies to ALL API endpoints without exception.** Every endpoint must:
1. Return appropriate HTTP status codes (4xx for client errors, 5xx for server errors)
2. Return a consistent error response format: `{ error: "message" }`
3. Frontend pages must check `response.ok` before processing response data

#### Global Error Response Behavior

All API endpoints shall adhere to the following error handling rules:

| HTTP Status | Backend Requirement | Frontend Requirement |
|-------------|--------------------|---------------------|
| 4xx (Client Errors) | Return error object with status code | Display Error Modal with clear message; do NOT continue operation |
| 5xx (Server Errors) | Return error object with status code | Display Error Modal with clear message; do NOT continue operation |

#### Error Modal Requirements

When any API request returns a 4xx or 5xx response:

1. Frontend MUST check `response.ok` before processing response data
2. Display an Error Modal to the user immediately
3. The modal shall show:
   - Clear, human-readable error message
   - Action to dismiss (e.g., "OK" button or "Try Again")
4. Do NOT proceed with any operation that depends on the failed request
5. Log the error server-side for debugging

#### Endpoint-Specific Error Codes

All endpoints not listed below shall return appropriate 4xx/5xx codes with `{ error: "description" }` format.

| Endpoint | Error Condition | HTTP Status | Error Message |
|----------|---------------|-------------|---------------|
| `POST /api/sandbox/create` | User does not exist | 404 | "User not found" |
| `POST /api/sandbox/create` | Exercise not found | 404 | "Exercise not found" |
| `POST /api/sandbox/exec` | Session not found | 404 | "Session not found" |
| `POST /api/sandbox/exec` | Invalid command (validation) | 400 | "Invalid command" |
| `GET /api/sandbox/state/[sessionId]` | Session not found | 404 | "Session not found" |
| `DELETE /api/sandbox/[sessionId]` | Session not found | 404 | "Session not found" |
| `POST /api/attempt` | Session not found | 404 | "Session not found" |
| `POST /api/attempt` | User does not match session owner | 403 | "Unauthorized" |
| `POST /api/attempt` | LLM evaluation fails after retries | 500 | "Evaluation failed" |
| `GET /api/profile` | Invalid userId format | 400 | "Invalid userId" |
| `GET /api/leaderboard` | Invalid limit/offset | 400 | "Invalid parameters" |

---

## 9. Performance Requirements

| Metric | Target |
|--------|--------|
| Page load time | < 2 seconds |
| Command execution | < 500ms per command |
| Session creation | < 3 seconds |
| Container spawn | < 2 seconds |

Note: LLM evaluation time is not bounded; backend waits until the request completes or fails.

---

## 10. Future Enhancements (Out of Scope for MVP)

- User authentication and named accounts
- Custom exercise creation
- Collaborative exercises
- Git remote repository simulation
- IDE integration
- Progress exporting/sharing
- Detailed learning paths
- Spaced repetition system
- Achievement badges
- Exercise difficulty rating
- Community solutions

---

## 11. Glossary

| Term | Definition |
|------|------------|
| Kata | A structured exercise for practice (from martial arts tradition) |
| Sandbox | Isolated environment for executing user commands |
| Session | A single exercise attempt with its own sandbox |
| LLM | Large Language Model (MiniMax in this case) |
| UUID | Universally Unique Identifier |
