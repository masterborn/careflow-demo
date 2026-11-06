# Scenario: prescription refill, from submission to review

Three agents, one shared app. Each step names the role(s) that run it and the exact text to send.
Before sending, replace `<ID>` with the request id the Patient reported in step 2.
Replace `<DECISION>` with **approve** (default) or **reject**.

| #   | Who                       | Runs             | Proves                                                                      |
| --- | ------------------------- | ---------------- | --------------------------------------------------------------------------- |
| 1   | patient, clinician, admin | at the same time | Stored sessions or vault credentials sign each role in to its own dashboard |
| 2   | patient                   | alone            | The Patient can submit a request                                            |
| 3   | clinician                 | alone            | The request appears in the Supervisor's queue and they decide on it         |
| 4   | patient, admin            | at the same time | The outcome reaches the Patient, and the Admin sees the full operation      |
| 5   | patient                   | alone (optional) | Role-based access: a patient can't see other patients' requests             |

---

## Step 1: Sign in (all three roles at the same time)

> Step 1: Sign in. Open http://localhost:5173 with your agent-browser session. If you land straight on your dashboard, the saved session worked, so say so. If you see the login page, sign in with your stored auth profile. Check that the header's role badge shows your role and your name. Save a screenshot as 01-dashboard.png. Report.

**Expected:** each window shows its own dashboard. The top bar is teal for the Patient, indigo for the Clinician and amber for the Admin.

## Step 2: Submit a request (patient)

> Step 2: Submit a new request: type "Prescription refill", subject "Atorvastatin 20 mg", details "90-day supply, running out on Friday", urgency Routine. Check that the confirmation message appears and that the request is listed under My requests as "Pending review". Report the request id (format RQ-####). Screenshot: 02-submitted.png.

**Expected:** confirmation "Request RQ-#### submitted…", and the new item shows as _Pending review_.

## Step 3: Review it (clinician)

Approve variant:

> Step 3: Request <ID> from Maya Patel should appear in your Review queue (it refreshes automatically, so wait up to 30 seconds). Check that it shows "Prescription refill: Atorvastatin 20 mg". Screenshot: 02-in-queue.png. Then type the clinical note "Approved for 90 days. Recheck lipids in 3 months." and click Approve <ID>. Check that it leaves the queue and appears under Recently reviewed as Approved. Screenshot: 03-approved.png. Report.

Reject variant (good for showing validation):

> Step 3: Request <ID> from Maya Patel should appear in your Review queue (wait up to 30 seconds). Screenshot: 02-in-queue.png. First click Reject <ID> with an empty note and check that the app refuses ("A note is required when rejecting"). Screenshot: 03-validation.png. Then type the note "Please book a lipid panel before we renew." and click Reject <ID>. Check that it appears under Recently reviewed as Rejected. Screenshot: 04-rejected.png. Report.

## Step 4: Outcome and summary (patient and admin at the same time)

Patient:

> Step 4: Without reloading, check that request <ID> under My requests now shows the clinician's decision (<DECISION>d by Dr. Sam Rivera) and their note. Screenshot: 03-outcome.png. Report the status and note exactly as shown.

Admin:

> Step 4: On the Operations overview, report the five KPI values. In the "Latest completed review" card, check that it's <ID>, and report its outcome, reviewer, note and turnaround, plus the timeline entries. Check that the Activity log has a "submitted" entry and a "<DECISION>d" entry for <ID>. Save a full-page screenshot (--full) as 02-overview.png. Report.

**Expected:** the Patient sees the decision and the note. The Admin's KPIs changed (one more approved or rejected, 0 pending), and the latest-review card and timeline show submitted → decision.

## Step 5 (optional): Access-control check (patient)

> Step 5: Negative test. Open http://localhost:5173/requests/RQ-1001, which belongs to a different patient. Expected: an "Access denied" page, with none of that request's details. Screenshot: 04-access-denied.png. Then go back to your dashboard. Report PASS if access was denied.
