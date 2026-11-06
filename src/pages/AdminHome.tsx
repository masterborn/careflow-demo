import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, formatDuration, formatTime, TYPE_LABEL, usePolling, type AuditEvent, type CareRequest } from '../api.ts'
import StatusBadge from '../components/StatusBadge.tsx'

interface Summary {
  counts: { total: number; pending: number; approved: number; rejected: number }
  avgTurnaroundMinutes: number | null
  latestDecided: CareRequest | null
  latestDecidedHistory: AuditEvent[]
  requests: CareRequest[]
  audit: AuditEvent[]
}

function Kpi({ label, value, tone, testid }: { label: string; value: string | number; tone?: string; testid: string }) {
  return (
    <div className={`kpi ${tone ?? ''}`} data-testid={testid}>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  )
}

export function Timeline({ events }: { events: AuditEvent[] }) {
  if (!events.length) return <p className="muted small">No recorded history (seeded example data).</p>
  return (
    <ol className="timeline" data-testid="timeline">
      {events.map((e) => (
        <li key={e.id} className={`tl tl-${e.action}`}>
          <span className="tl-dot" aria-hidden />
          <div>
            <div><strong>{e.actorName}</strong> <span className="muted">({e.actorRole})</span> · {e.action}</div>
            <div className="small">{e.detail}</div>
            <div className="muted small">{formatTime(e.at)}</div>
          </div>
        </li>
      ))}
    </ol>
  )
}

export default function AdminHome() {
  const { data, refresh } = usePolling<Summary>('/api/admin/summary')
  const [confirmReset, setConfirmReset] = useState(false)

  async function reset() {
    if (!confirmReset) return setConfirmReset(true)
    await api('/api/admin/reset', { method: 'POST' })
    setConfirmReset(false)
    refresh()
  }

  if (!data) return <p className="muted">Loading summary…</p>
  const { counts, latestDecided: last } = data

  return (
    <>
      <section className="hero row">
        <div>
          <h1>Operations overview</h1>
          <p className="muted">Live summary of every patient request and review decision.</p>
        </div>
        <button className={`btn ${confirmReset ? 'reject' : 'ghost'}`} onClick={reset} onBlur={() => setConfirmReset(false)} data-testid="reset-demo">
          {confirmReset ? 'Click again to confirm reset' : 'Reset demo data'}
        </button>
      </section>

      <section className="kpis" aria-label="Key metrics">
        <Kpi label="Total requests" value={counts.total} testid="kpi-total" />
        <Kpi label="Pending review" value={counts.pending} tone="pending" testid="kpi-pending" />
        <Kpi label="Approved" value={counts.approved} tone="approved" testid="kpi-approved" />
        <Kpi label="Rejected" value={counts.rejected} tone="rejected" testid="kpi-rejected" />
        <Kpi label="Avg. review time" value={formatDuration(data.avgTurnaroundMinutes)} testid="kpi-turnaround" />
      </section>

      <div className="grid two">
        <section className="card" aria-labelledby="latest-h" data-testid="latest-operation">
          <h2 id="latest-h">Latest completed review</h2>
          {last ? (
            <>
              <div className="item-top">
                <Link to={`/requests/${last.id}`} className="ref">{last.id}</Link>
                <StatusBadge status={last.status} />
              </div>
              <div className="item-title">{TYPE_LABEL[last.type]}: {last.subject}</div>
              <dl className="facts">
                <dt>Patient</dt><dd>{last.patientName}</dd>
                <dt>Reviewer</dt><dd>{last.reviewerName}</dd>
                <dt>Outcome</dt><dd data-testid="latest-outcome">{last.status}</dd>
                <dt>Note</dt><dd>{last.reviewNote ?? '—'}</dd>
                <dt>Turnaround</dt>
                <dd data-testid="latest-turnaround">
                  {formatDuration((Date.parse(last.decidedAt!) - Date.parse(last.createdAt)) / 60_000)}
                </dd>
              </dl>
              <Timeline events={data.latestDecidedHistory} />
            </>
          ) : (
            <p className="muted">No reviews completed yet.</p>
          )}
        </section>

        <section className="card" aria-labelledby="audit-h">
          <h2 id="audit-h">Activity log</h2>
          <ul className="audit" data-testid="audit-log">
            {data.audit.map((e) => (
              <li key={e.id} className={`audit-${e.action}`}>
                <span className="muted small">{formatTime(e.at)}</span>
                <span className={`pill pill-${e.action}`}>{e.action}</span>
                <span>{e.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card" aria-labelledby="all-h">
        <h2 id="all-h">All requests</h2>
        <div className="table-wrap">
          <table data-testid="all-requests">
            <thead>
              <tr><th>Ref</th><th>Patient</th><th>Type</th><th>Subject</th><th>Status</th><th>Submitted</th><th>Reviewed by</th><th>Turnaround</th></tr>
            </thead>
            <tbody>
              {data.requests.map((r) => (
                <tr key={r.id} data-testid={`row-${r.id}`}>
                  <td><Link to={`/requests/${r.id}`}>{r.id}</Link></td>
                  <td>{r.patientName}</td>
                  <td>{TYPE_LABEL[r.type]}</td>
                  <td>{r.subject}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{formatTime(r.createdAt)}</td>
                  <td>{r.reviewerName ?? '—'}</td>
                  <td>{r.decidedAt ? formatDuration((Date.parse(r.decidedAt) - Date.parse(r.createdAt)) / 60_000) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
