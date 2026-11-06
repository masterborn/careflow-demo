# Orchestrator prompt

Paste the block below into a Claude Code session that is **running inside herdr**,
with its working directory set to this project. Change `DECISION` if you want the reject path.

**The three role agents (patient, clinician, admin) run on Sonnet 5.5.** The orchestrator session
that drives them can run on Opus 5.5:

```bash
claude --model claude-opus-5-5
```

---

Use the herdr skill to run the CareFlow multi-role QA demo. DECISION = approve. MODEL = claude-sonnet-5-5

**Model rule:** you, the orchestrator, may run on Opus 5.5. The three role agents you start
(patient, clinician, admin) must run on MODEL (Sonnet 5.5): every agent you start gets `--model MODEL`.
Don't spawn subagents, and don't start a role agent on any other model.

0. **Test plan:** before doing anything else, read `prompts/scenario.md` and show the audience the tests you're about to run.
   Write the plan as plain message text in this pane (not inside a tool call), as a numbered table with columns
   step, who, runs (alone or at the same time) and what it proves. Show the step-3 variant that matches DECISION,
   and list the five steps only, not the prompts you'll send. End the plan with "Reply **go** to start."
   Then end your turn and wait for my reply. Don't run any tool calls first. Start step 1 only once I confirm.
   If I ask for changes instead, adjust the plan and ask again.
1. **Browser mode:** once I've said go, ask me how the role browsers should run. Use the AskUserQuestion tool
   (or a plain question if it isn't available) with two options:
   - **Headed:** one visible Chrome window per role.
   - **Headless + dashboard:** no role windows. One browser window shows the agent-browser dashboard with every session live.

   Wait for my answer and remember it as MODE (`headed` or `headless`).

2. **App check:** `curl -s http://localhost:5173/api/me` must answer (a 401 JSON error is fine).
   If it doesn't, split a pane down from this one, run `pnpm dev` there and wait for "ready".
3. **Browser setup:**
   - Close any role browsers left over from an earlier run, so MODE takes effect. For each role, run
     `agent-browser --session careflow-<role> --restore --headed false close`.
     This saves each login. Always pass `--headed false` here: agent-browser relaunches a browser whose flags don't match,
     and with this flag any relaunch stays invisible. A "not running" message is fine.
   - **If MODE is headless:** run `agent-browser dashboard start`. Then open the dashboard in **one regular, visible
     Chrome window** with `google-chrome-stable --new-window http://localhost:4848 >/dev/null 2>&1 &`
     (fall back to `xdg-open http://localhost:4848`). Don't open it through agent-browser: that window would show up in the
     dashboard as a session of its own. Tell me the URL.
   - **Open the role browsers in order: patient first, then clinician, then admin.** Run one command per role, and run each
     one only after the previous one has returned, so the windows (or the dashboard's sidebar sessions) appear in that order:
     - headed: `agent-browser --session careflow-<role> --restore open about:blank`
     - headless: `agent-browser --session careflow-<role> --restore --headed false open about:blank`

     These flags match the agents' PREFIX, so in step 1 each agent reuses its open browser instead of launching a new one.
4. **Layout:** create a new herdr tab labelled `careflow-qa` in this workspace, with its cwd set to this project, and focus it so the audience sees it.
   Split it into **three equal-width columns**, left to right: **patient**, **clinician**, **admin**.
   `--ratio` sets the share the original pane keeps, so split the root (patient) pane `--direction right --ratio 0.3333`
   to get clinician, then split the clinician pane `--direction right --ratio 0.5` to get admin. Name the panes after the roles.
5. **Agents:** start a Claude agent on MODEL in each pane, named `patient`, `clinician` and `admin`
   (`herdr agent start <name> --kind claude --pane <pane-id> -- --model claude-sonnet-5-5`).
   **Start each agent right after its pane is created, before making the next split:** patient right after the tab is
   created, clinician right after the first split, and admin right after the second. Once the fish prompt has rendered, it can leave a
   defunct `fish` child in the pane's foreground, and herdr then rejects the start with `agent_pane_busy`.
   If that happens anyway, close that pane and split it again from the same neighbour with the same direction and ratio,
   then start the agent at once. If it's the patient pane, close the `careflow-qa` tab and redo step 4.
   Check that each one is running on Sonnet 5.5 (its Claude Code header shows the model, e.g. via
   `herdr agent read <name> --source visible`). If any of them isn't, stop and tell me.
6. **Briefing:** send each agent "Read prompts/roles/<name>.md. It is your role brief for this session. BROWSER MODE: <MODE>."
   Wait until all three have replied "ready".
   The brief includes **presentation pacing**: type character by character, pause 2 s before every submit,
   approve or reject click, and one click per command. If an agent's report shows it skipped the pacing,
   remind it before you send the next step.
   In headless mode, also watch for a stray visible window. That means an agent ran a command without `--headed false`,
   so remind it to use its PREFIX.
7. **Scenario:** run `prompts/scenario.md` step by step, steps 1 to 5:
   - For a step that runs "at the same time", send the prompt to every listed agent first, then wait for each one.
   - Otherwise send it with `--wait`, then read the agent's reply before moving on.
   - Take the request id from the patient's step-2 report and use it in place of `<ID>` in later steps.
     Use DECISION in place of `<DECISION>`, and choose the matching step-3 variant.
   - **Headless mode:** before sending each step, tell me which session to select in the dashboard sidebar
     (`careflow-patient`, `careflow-clinician` or `careflow-admin`). For steps that run at the same time, name the most interesting one.
   - If an agent reports FAIL or gets blocked on a permission prompt, stop and tell me.
     Don't answer prompts on its behalf.
8. **Report:** finish with a table (step, role, PASS/FAIL, key observation, screenshot paths).
   Then list everything under `screenshots/`.

Don't close the tab, the agents, the browsers or the dashboard when you're done. I'll go through them and the screenshots with the audience.
