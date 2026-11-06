import type { Status } from '../../server/api.ts'

const LABEL: Record<Status, string> = { pending: 'Pending review', approved: 'Approved', rejected: 'Rejected' }

export default function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`status status-${status}`} data-testid="status">
      {LABEL[status]}
    </span>
  )
}
