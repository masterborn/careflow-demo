import { useState } from 'react'

// How long a just-decided card stays in the queue so the audience sees which button was clicked.
const LINGER_MS = 3000
import { Link } from 'react-router-dom'
import { api, formatTime, TYPE_LABEL, usePolling, type CareRequest } from '../api.ts'
import { useAuth } from '../App.tsx'
import StatusBadge from '../components/StatusBadge.tsx'

function ReviewCard({ r, onDecided }: { r: CareRequest; onDecided: (r: CareRequest) => void }) {
  const [note, setNote] = useState('')
  const [chosen, setChosen] = useState<'approved' | 'rejected' | null>(null)
  const decided = r.status !== 'pending'
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function decide(decision: 'approved' | 'rejected') {
    setBusy(true)
    setError('')
    try {
      const { request } = await api<{ request: CareRequest }>(`/api/requests/${r.id}/decision`, { method: 'POST', body: { decision, note } })
      setChosen(decision)
      onDecided(request)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className={`item review ${r.urgency} ${decided ? r.status : ''}`} data-testid={`review-${r.id}`}>
      <div className="item-top">
        <Link to={`/requests/${r.id}`} className="ref">{r.id}</Link>
        {r.urgency === 'urgent' && <span className="status status-urgent">Urgent</span>}
        <StatusBadge status={r.status} />
      </div>
      <div className="item-title">{TYPE_LABEL[r.type]}: {r.subject}</div>
      <div className="muted small">From <strong>{r.patientName}</strong> · {formatTime(r.createdAt)}</div>
      {r.details && <p className="details">{r.details}</p>}
      <label className="note">
        Clinical note for {r.id}
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Required when rejecting"
          disabled={decided}
          data-testid={`note-${r.id}`}
        />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="actions">
        <button className={`btn approve ${chosen === 'approved' ? 'chosen' : ''}`} disabled={busy || decided} onClick={() => decide('approved')} data-testid={`approve-${r.id}`}>
          Approve {r.id}
        </button>
        <button className={`btn reject ${chosen === 'rejected' ? 'chosen' : ''}`} disabled={busy || decided} onClick={() => decide('rejected')} data-testid={`reject-${r.id}`}>
          Reject {r.id}
        </button>
      </div>
      {decided && (
        <p className="notice" role="status" data-testid={`decided-${r.id}`}>
          {r.id} {r.status}. Moving to Recently reviewed…
        </p>
      )}
    </li>
  )
}

export default function ClinicianHome() {
  const { user } = useAuth()
  const { data, refresh } = usePolling<{ requests: CareRequest[] }>('/api/requests')
  // Cards decided a moment ago stay visible briefly, showing the outcome and the clicked button.
  const [lingering, setLingering] = useState<Record<string, CareRequest>>({})
  const requests = data?.requests ?? []
  const pending = requests.filter((r) => r.status === 'pending')
  const queue = [...pending, ...Object.values(lingering).filter((l) => !pending.some((p) => p.id === l.id))]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  function onDecided(r: CareRequest) {
    setLingering((m) => ({ ...m, [r.id]: r }))
    refresh()
    window.setTimeout(() => {
      setLingering(({ [r.id]: _gone, ...rest }) => rest)
    }, LINGER_MS)
  }
  const reviewed = requests
    .filter((r) => r.status !== 'pending')
    .sort((a, b) => (b.decidedAt ?? '').localeCompare(a.decidedAt ?? ''))
    .slice(0, 6)

  return (
    <>
      <section className="hero">
        <h1>Good day, {user?.name}</h1>
        <p className="muted">Patient requests waiting for your review show up here automatically.</p>
      </section>

      <div className="grid two wide-left">
        <section className="card" aria-labelledby="queue-h">
          <div className="card-head">
            <h2 id="queue-h">Review queue</h2>
            <span className="count" data-testid="queue-count">{pending.length} pending</span>
          </div>
          {queue.length === 0 ? (
            <p className="muted empty-state" data-testid="queue-empty">No requests waiting for review. 🎉</p>
          ) : (
            <ul className="list" data-testid="review-queue">
              {queue.map((r) => <ReviewCard key={r.id} r={r} onDecided={onDecided} />)}
            </ul>
          )}
        </section>

        <section className="card" aria-labelledby="reviewed-h">
          <h2 id="reviewed-h">Recently reviewed</h2>
          <ul className="list compact" data-testid="recently-reviewed">
            {reviewed.map((r) => (
              <li key={r.id} className={`item ${r.status}`}>
                <div className="item-top">
                  <Link to={`/requests/${r.id}`} className="ref">{r.id}</Link>
                  <StatusBadge status={r.status} />
                </div>
                <div className="item-title">{r.subject}</div>
                <div className="muted small">{r.patientName} · {formatTime(r.decidedAt)}</div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}
