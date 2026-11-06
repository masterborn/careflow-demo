import { Link, useParams } from 'react-router-dom'
import { formatTime, TYPE_LABEL, usePolling, type AuditEvent, type CareRequest } from '../api.ts'
import StatusBadge from '../components/StatusBadge.tsx'
import { Timeline } from './AdminHome.tsx'

export default function RequestDetail() {
  const { id } = useParams()
  const { data, error } = usePolling<{ request: CareRequest; history: AuditEvent[] }>(`/api/requests/${id}`)

  if (error) {
    return (
      <section className="card empty" data-testid="request-error">
        <h1>{error.status === 403 ? 'Access denied' : error.status === 404 ? 'Request not found' : 'Something went wrong'}</h1>
        <p className="muted">{error.message}</p>
        <p><Link to="/">Back to your dashboard</Link></p>
      </section>
    )
  }
  if (!data) return <p className="muted">Loading…</p>
  const r = data.request

  return (
    <>
      <p><Link to="/">← Back to dashboard</Link></p>
      <section className="card detail" data-testid="request-detail">
        <div className="item-top">
          <h1 className="ref big">{r.id}</h1>
          <StatusBadge status={r.status} />
        </div>
        <h2>{TYPE_LABEL[r.type]}: {r.subject}</h2>
        <dl className="facts">
          <dt>Patient</dt><dd>{r.patientName}</dd>
          <dt>Urgency</dt><dd>{r.urgency}</dd>
          <dt>Submitted</dt><dd>{formatTime(r.createdAt)}</dd>
          <dt>Details</dt><dd>{r.details || '—'}</dd>
          <dt>Reviewer</dt><dd>{r.reviewerName ?? '—'}</dd>
          <dt>Decided</dt><dd>{formatTime(r.decidedAt)}</dd>
          <dt>Note</dt><dd data-testid="detail-note">{r.reviewNote ?? '—'}</dd>
        </dl>
        <h3>History</h3>
        <Timeline events={data.history} />
      </section>
    </>
  )
}
