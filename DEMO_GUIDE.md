# CareFlow demo guide: herdr + agent-browser for multi-role QA

This guide covers four things:

1. Starting the mock app.
2. **Doing the one-time setup by hand.** You sign in once as each role and store the credentials and sessions, so later runs need no login.
3. Getting herdr to open one pane, with one agent, per role.
4. Running the cross-role scenario and reviewing the screenshots.

```
                ┌──────────────── herdr tab "careflow-qa" ───────────────┐
                │  pane: patient       │  pane: clinician                 │
  orchestrator  │  claude agent ──► agent-browser --session careflow-…   │
  (your Claude  │        │             │        │                         │
   in herdr) ──►│        ▼             ├────────┼─────────────────────────┤
  herdr agent   │  Chrome window       │  pane: admin                     │
  prompt/wait   │  (teal)              │  claude agent ──► Chrome (amber) │
                └──────────────────────┴──────────────────────────────────┘
                              all three talk to  http://localhost:5173
```

---

## 0. Accounts

| Role                   | Email                         | Password              | agent-browser name*  | Header colour |
| ---------------------- | ----------------------------- | --------------------- | -------------------- | ------------- |
| Patient                | `maya.patient@careflow.test`  | `patient-pass-2026`   | `careflow-patient`   | teal          |
| Clinician (Supervisor) | `sam.clinician@careflow.test` | `clinician-pass-2026` | `careflow-clinician` | indigo        |
| Admin                  | `alex.admin@careflow.test`    | `admin-pass-2026`     | `careflow-admin`     | amber         |

\* The same name is used for the **auth vault profile** and the **browser session**. They are different things, explained below.

## 1. Start the app

```bash
cd careflow-demo      # the cloned repo
pnpm install        # first time only
pnpm dev            # → http://localhost:5173
```

The API runs inside the Vite dev server, so one process covers everything.
Data is kept in `data/db.json`, so it survives restarts.

## 2. Concepts: three ways agent-browser remembers who you are

| Mechanism           | Command                      | What it stores                                                     | Where                                                                | Use it for                                                                             |
| ------------------- | ---------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Session**         | `--session careflow-patient` | Nothing on disk. It's a separate, isolated browser (cookies, tabs) | in memory                                                            | Running several users at once without them interfering                                 |
| **Session restore** | `--session X --restore`      | Cookies + localStorage, saved on `close` and every 30 s            | `~/.agent-browser/sessions/X-X.json`                                 | **Skipping the login** on later runs                                                   |
| **Auth vault**      | `auth save` / `auth login`   | Username + password, **encrypted**                                 | `~/.agent-browser/auth/` (key in `~/.agent-browser/.encryption-key`) | **Logging in again** when the saved session has expired. Agents never see the password |

So the recipe for repeatable testing is:
**the vault gives the agent a way to log in, and restore means it usually doesn't have to.**

`agent-browser.json` in this folder sets `"headed": true`. Every browser started from here gets a visible window,
so the audience can watch. To run a session headless, pass `--headed false` on **every** command of that session,
`close` included. agent-browser relaunches a browser whose launch flags don't match the running one, so one command
without the flag brings back a visible window.

---

## 3. One-time manual setup (do this together with the audience)

Run these in a plain terminal in the project folder, with the app running. Do the patient first and explain each step, then the other two roles go quickly.

### 3.1 Store the credentials in the vault

```bash
agent-browser auth save careflow-patient \
  --url http://localhost:5173/login \
  --username maya.patient@careflow.test \
  --password-stdin
# type: patient-pass-2026   then press Enter, Ctrl+D
```

`--password-stdin` keeps the password out of your shell history and `ps` output. Check the result:

```bash
agent-browser auth list                # names + URLs only
agent-browser auth show careflow-patient   # metadata; it never prints the password
```

### 3.2 First login, which creates the persisted session

**Option A: let the vault log in** (you'll see the form fill itself in):

```bash
agent-browser --session careflow-patient --restore auth login careflow-patient
agent-browser --session careflow-patient get url    # → http://localhost:5173/  (the dashboard)
```

**Option B: log in by hand in the agent-browser window.** This is the pattern for SSO or 2FA apps, where a vault can't log in for you:

```bash
agent-browser --session careflow-patient --restore open http://localhost:5173/login
# …type the email and password yourself in the window that opens…
```

Either way, finish by closing the browser, which **saves** the session state:

```bash
agent-browser --session careflow-patient --restore close    # prints: save: saved
ls ~/.agent-browser/sessions/                                # careflow-patient-careflow-patient.json
```

### 3.3 Prove it works: a fresh browser with no login

```bash
agent-browser --session careflow-patient --restore open http://localhost:5173/
# prints "restore: loaded" and the window opens straight on "Hello, Maya"
```

You can make agent-browser _check_ the restored state, so a stale session gets noticed:

```bash
agent-browser --session careflow-patient --restore --restore-check-text "My requests" open http://localhost:5173/
agent-browser --session careflow-patient session info --json | jq '.data.runtime.restoreStatus'
```

### 3.4 Repeat for the other two roles

```bash
agent-browser auth save careflow-clinician --url http://localhost:5173/login --username sam.clinician@careflow.test --password-stdin
agent-browser auth save careflow-admin     --url http://localhost:5173/login --username alex.admin@careflow.test     --password-stdin

agent-browser --session careflow-clinician --restore auth login careflow-clinician && agent-browser --session careflow-clinician --restore close
agent-browser --session careflow-admin     --restore auth login careflow-admin     && agent-browser --session careflow-admin     --restore close
```

You can now open all three side by side to show that the sessions are isolated: three windows, three different users, one app.

### 3.5 Teaching moment: what happens when a session expires?

```bash
pnpm reset    # wipes data/db.json, including every server-side login session
agent-browser --session careflow-patient --restore open http://localhost:5173/
# → the login page: the restored cookie is no longer valid
agent-browser --session careflow-patient --restore auth login careflow-patient
# → back in. The vault is the fallback, which is why the role briefs tell agents to use it.
```

(The admin's **Reset demo data** button resets only the requests. Login sessions are kept, so a mid-demo reset doesn't log anyone out.)

### 3.6 Optional: a portable state file (e.g. for CI)

```bash
agent-browser --session careflow-patient state save auth/patient.json   # plaintext cookies, already gitignored
agent-browser --session ci-run --state auth/patient.json open http://localhost:5173/
```

Set `AGENT_BROWSER_ENCRYPTION_KEY` to encrypt state at rest. Never commit these files.

---

## 4. Orchestrating with herdr

### 4.0 One-time: let the role agents run agent-browser without prompts

Each pane runs its own Claude Code agent, and by default every `agent-browser` call asks for approval.
That stalls a live demo. If you're happy to allow it, add this to `careflow-demo/.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "Bash(agent-browser:*)",
      "Bash(mkdir -p screenshots/*)",
      "Read(prompts/**)",
      "Read(screenshots/**)"
    ]
  }
}
```

### 4.1 The herdr mental model

- **workspace → tab → pane.** IDs look like `w0`, `w0:t2`, `w0:p3`. Always read them from the JSON responses; don't guess.
- A pane is just a terminal. `herdr agent start` puts a coding agent in it and gives it a **name** (`patient`).
- `herdr agent prompt <name> "…" --wait` sends text and waits until the agent is idle again.
  `herdr agent read <name>` shows what it said.

### 4.2 Option A: let Claude do it (the demo)

The three role agents run on **Sonnet 5.5**. The orchestrator that drives them can run on **Opus 5.5**.
Inside herdr, in this folder, start the orchestrator with:

```bash
claude --model claude-opus-5-5
```

Then paste the block from [`prompts/orchestrator.md`](prompts/orchestrator.md). Claude uses the herdr skill to do the following:

1. Show the test plan and wait for you to say **go**.
2. **Ask whether the browsers run headed or headless.**
   - **Headed:** three visible Chrome windows, one per role.
   - **Headless:** no role windows. Claude starts the agent-browser dashboard (`agent-browser dashboard start`)
     and opens it in one ordinary Chrome window at http://localhost:4848. The sidebar lists `careflow-patient`,
     `careflow-clinician` and `careflow-admin`. Click one to watch it live. Before each step, Claude tells you which one to select.
3. Create a `careflow-qa` tab with panes for patient, clinician and admin.
4. Start a Claude agent in each pane, named after its role, with `--model claude-sonnet-5-5`.
5. Brief each agent with `prompts/roles/<role>.md` plus the browser mode. The brief gives the agent its session,
   vault profile, screenshot folder, command prefix (with `--headed false` when headless) and rules.
   The rules include **presentation pacing**:
   - Text is typed character by character.
   - There's a 2-second pause before every submit, approve or reject click.
   - Each click is a separate command.
     The app rings whatever was just clicked in fuchsia, and a decided review card stays in the queue for 3 seconds.
6. Run [`prompts/scenario.md`](prompts/scenario.md) step by step, sending steps to several agents at once where they don't depend on each other.

### 4.3 Option B: the same thing by hand (to explain what Claude did)

```bash
cd careflow-demo      # the cloned repo
T=$(herdr tab create --cwd "$PWD" --label careflow-qa --focus)
ROOT=$(jq -r .result.root_pane.pane_id <<<"$T")
RIGHT=$(herdr pane split "$ROOT"  --direction right --cwd "$PWD" --no-focus | jq -r .result.pane.pane_id)
BOTTOM=$(herdr pane split "$RIGHT" --direction down  --cwd "$PWD" --no-focus | jq -r .result.pane.pane_id)
herdr pane rename "$ROOT" patient; herdr pane rename "$RIGHT" clinician; herdr pane rename "$BOTTOM" admin

# everything after `--` goes to claude itself, here pinning the model
herdr agent start patient   --kind claude --pane "$ROOT"   -- --model claude-sonnet-5-5
herdr agent start clinician --kind claude --pane "$RIGHT"  -- --model claude-sonnet-5-5
herdr agent start admin     --kind claude --pane "$BOTTOM" -- --model claude-sonnet-5-5

MODE=headed   # or: headless (then also: agent-browser dashboard start && google-chrome-stable --new-window http://localhost:4848 &)
for r in patient clinician admin; do
  herdr agent prompt $r "Read prompts/roles/$r.md. It is your role brief for this session. BROWSER MODE: $MODE." --wait --timeout 120000
done

# Step 1: all at once (send to everyone, then wait for each)
S1='Step 1: Sign in. Open http://localhost:5173 with your agent-browser session. …'   # full text in prompts/scenario.md
for r in patient clinician admin; do herdr agent prompt $r "$S1"; done
for r in patient clinician admin; do herdr agent wait $r --timeout 300000; done

# Step 2 → read the patient's answer to get the request id
herdr agent prompt patient "Step 2: Submit a new request: …" --wait --timeout 300000
herdr agent read patient --source recent-unwrapped --lines 60
```

---

## 5. What the audience should see

| Step | Patient window (teal)                     | Clinician window (indigo)                  | Admin window (amber)                  |
| ---- | ----------------------------------------- | ------------------------------------------ | ------------------------------------- |
| 1    | Dashboard, no login typed                 | Dashboard, empty review queue              | KPIs, seeded history                  |
| 2    | Submits RQ-1004 → _Pending review_        | **RQ-1004 appears by itself** (polling)    | Pending KPI goes to 1                 |
| 3    | Status changes to _Approved_ + note, live | Approves with a note → _Recently reviewed_ | Latest review card + timeline fill in |
| 4    | Reports outcome                           | –                                          | Reports KPIs, turnaround, audit trail |
| 5    | `/requests/RQ-1001` → **Access denied**   | –                                          | –                                     |

Afterwards, go through `screenshots/<role>/NN-*.png` with the team. Each agent numbered its own
evidence, which is how QA reports usually look.

## 6. Reset between rehearsals

| Goal                                        | Do                                                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Fresh requests, stay logged in              | Admin dashboard → **Reset demo data** (click twice)                                                                 |
| Fresh everything, including server sessions | `pnpm reset` (agents fall back to `auth login`)                                                                     |
| Remove screenshots                          | `rm -rf screenshots`                                                                                                |
| Close the browsers                          | `agent-browser --session careflow-<role> --restore --headed false close` (works for both modes and saves the login) |
| Stop the dashboard                          | `agent-browser dashboard stop`                                                                                      |
| Forget everything agent-browser stored      | `agent-browser auth delete careflow-<role>`, then `rm ~/.agent-browser/sessions/careflow-*`                         |
| Close the herdr demo tab                    | `herdr tab close <tab-id>` (from `herdr tab list`)                                                                  |

## 7. Cheat sheet

```bash
agent-browser auth save <name> --url <login-url> --username <u> --password-stdin
agent-browser auth list | show <name> | delete <name>
agent-browser --session <s> --restore auth login <name>          # vault login + persist
agent-browser --session <s> --restore open <url>                 # reuse saved session
agent-browser --session <s> --restore close                      # save + close
agent-browser --session <s> snapshot -i                          # what can I click?
agent-browser --session <s> screenshot screenshots/<role>/01.png [--full]
agent-browser session list
agent-browser dashboard start | stop                              # live view of all sessions at http://localhost:4848

herdr tab create --label <l> --cwd "$PWD" --focus
herdr pane split <pane> --direction right|down --cwd "$PWD" --no-focus
herdr agent start <name> --kind claude --pane <pane> -- --model claude-sonnet-5-5
herdr agent prompt <name> "<text>" [--wait --timeout ms]
herdr agent wait <name> | read <name> --source recent-unwrapped --lines 80
herdr agent list
```
