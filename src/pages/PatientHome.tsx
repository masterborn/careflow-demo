import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, formatTime, TYPE_LABEL, usePolling, type CareRequest, type RequestType } from '../api.ts'
import { useAuth } from '../App.tsx'
import StatusBadge from '../components/StatusBadge.tsx'

export default function PatientHome() {
  const { user } = useAuth()
  const { data, refresh } = usePolling<{ requests: CareRequest[] }>('/api/requests')
  const [type, setType] = useState<RequestType>('refill')
  const [subject, setSubject] = useState('')
  const [details, setDetails] = useState('')
  const [urgency, setUrgency] = useState<'routine' | 'urgent'>('routine')
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState<CareRequest | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { request } = await api<{ request: CareRequest }>('/api/requests', {
        method: 'POST',
        body: { type, subject, details, urgency },
      })
      setSubmitted(request)
      setSubject('')
      setDetails('')
      setUrgency('routine')
      refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const requests = data?.requests ?? []
  const pending = requests.filter((r) => r.status === 'pending').length

  return (
    <>
      <section className="hero">
        <h1>Hello, {user?.name.split(' ')[0]}</h1>
        <p className="muted">
          Request a prescription refill, an appointment or a referral. A clinician reviews every request.
        </p>
      </section>

      <div className="grid two">
        <section className="card" aria-labelledby="new-request-h">
          <h2 id="new-request-h">New request</h2>
          <form onSubmit={submit} className="form" data-testid="new-request-form">
            <label>
              Request type
              <select value={type} onChange={(e) => setType(e.target.value as RequestType)} data-testid="request-type">
                {Object.entries(TYPE_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </label>
            <label>
              Subject
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={type === 'refill' ? 'e.g. Atorvastatin 20 mg' : 'Short summary'}
                data-testid="request-subject"
              />
            </label>
            <label>
              Details for the clinician
              <textarea
                rows={3}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Dosage, symptoms, preferred times…"
                data-testid="request-details"
              />
            </label>
            <fieldset className="radios">
              <legend>Urgency</legend>
              <label><input type="radio" name="urgency" checked={urgency === 'routine'} onChange={() => setUrgency('routine')} /> Routine</label>
              <label><input type="radio" name="urgency" checked={urgency === 'urgent'} onChange={() => setUrgency('urgent')} /> Urgent</label>
            </fieldset>
            {error && <p className="error" role="alert" data-testid="request-error">{error}</p>}
            <button className="btn primary" type="submit" disabled={busy} data-testid="submit-request">
              Submit for review
            </button>
            {submitted && (
              <p className="notice" role="status" data-testid="submit-confirmation">
                Request <strong>{submitted.id}</strong> submitted. It's waiting for clinician review.
              </p>
            )}
          </form>
        </section>

        <section className="card" aria-labelledby="my-requests-h">
          <div className="card-head">
            <h2 id="my-requests-h">My requests</h2>
            <span className="muted small" data-testid="pending-count">{pending} awaiting review</span>
          </div>
          {requests.length === 0 ? (
            <p className="muted">No requests yet.</p>
          ) : (
            <ul className="list" data-testid="my-requests">
              {requests.map((r) => (
                <li key={r.id} className={`item ${r.status}`} data-testid={`request-${r.id}`}>
                  <div className="item-top">
                    <Link to={`/requests/${r.id}`} className="ref">{r.id}</Link>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="item-title">{TYPE_LABEL[r.type]}: {r.subject}</div>
                  <div className="muted small">Submitted {formatTime(r.createdAt)}</div>
                  {r.status !== 'pending' && (
                    <div className="decision" data-testid="decision">
                      <strong>{r.status === 'approved' ? 'Approved' : 'Rejected'}</strong> by {r.reviewerName} · {formatTime(r.decidedAt)}
                      {r.reviewNote && <blockquote data-testid="review-note">{r.reviewNote}</blockquote>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}
