# AGENTS.md

CareFlow is a mock three-role healthcare app (patient, clinician, admin) that serves as a practice target for
multi-agent browser QA demos. [README.md](README.md) covers what it is, the accounts and the layout.

**If a role brief from `prompts/roles/` was given to you, follow that brief and the scenario steps you're sent.**
The rest of this file is for agents changing the app or its docs.

## Run and verify

- `pnpm install`, then `pnpm dev` serves the app and the mock API on http://localhost:5173.
  The API is Vite middleware (`server/api.ts`), so the app works only under `pnpm dev`, and only on that port.
- `pnpm build` is the check: it typechecks and bundles. A change is done when `pnpm build` passes and, for UI or API
  changes, the affected flow works in the running app (drive it with agent-browser or a browser).
- Format markdown with `pnpm dlx oxfmt '**/*.md'`.

## The demo contract

The prompts in `prompts/` and `DEMO_GUIDE.md` drive agents by exact UI text, so the app and those docs change together.
They depend on:

- the `data-testid`s and accessible names, e.g. the `Approve RQ-####` / `Reject RQ-####` buttons
- visible text such as `Hello, Maya`, `My requests`, `Review queue`, `Recently reviewed`, `Access denied`
  and the error `A note is required when rejecting`
- the seed data in `server/api.ts`: requests RQ-1001 to RQ-1003, so the first new request is RQ-1004, and RQ-1001
  belongs to another patient (the access-control step)
- the account emails and passwords, and the header colour per role (teal, indigo, amber)

When you change any of these, grep `prompts/`, `DEMO_GUIDE.md` and `README.md` for the old value and update every hit.

## State

- `data/db.json` holds requests, the audit log **and login sessions**. It is created from the seed on first request.
  After changing the seed, run `pnpm reset` to see it.
- The admin's **Reset demo data** keeps sessions; `pnpm reset` drops them. The demo guide's "expired session" lesson
  relies on that difference.
- `data/`, `screenshots/` and `auth/` are runtime output and stay out of git. Every person and record in the app is
  fictional; keep it that way.
