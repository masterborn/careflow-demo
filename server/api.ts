/**
 * CareFlow mock API, mounted as Vite middleware so `pnpm dev` runs everything on one port.
 *
 * Storage: a JSON file in data/db.json. Login sessions are stored there too, so a
 * browser session saved by agent-browser keeps working after the dev server restarts.
 */
import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export type Role = 'patient' | 'clinician' | 'admin'

interface User {
  id: string
  email: string
  password: string
  name: string
  role: Role
  title: string
}

export type RequestType = 'refill' | 'appointment' | 'referral'
export type Status = 'pending' | 'approved' | 'rejected'

export interface CareRequest {
  id: string // e.g. RQ-1004
  patientId: string
  patientName: string
  type: RequestType
  subject: string
  details: string
  urgency: 'routine' | 'urgent'
  status: Status
  createdAt: string
  decidedAt?: string
  reviewerName?: string
  reviewNote?: string
}

export interface AuditEvent {
  id: number
  at: string
  actorName: string
  actorRole: Role | 'system'
  action: 'login' | 'logout' | 'submitted' | 'approved' | 'rejected' | 'reset'
  requestId?: string
  detail: string
}

interface Db {
  nextRequestNumber: number
  nextAuditId: number
  requests: CareRequest[]
  audit: AuditEvent[]
  sessions: Record<string, { userId: string; createdAt: string }>
}

// ---------------------------------------------------------------------------
// Demo accounts (also listed in README.md / DEMO_GUIDE.md)
// ---------------------------------------------------------------------------
const USERS: User[] = [
  {
    id: 'u-patient',
    email: 'maya.patient@careflow.test',
    password: 'patient-pass-2026',
    name: 'Maya Patel',
    role: 'patient',
    title: 'Patient',
  },
  {
    id: 'u-clinician',
    email: 'sam.clinician@careflow.test',
    password: 'clinician-pass-2026',
    name: 'Dr. Sam Rivera',
    role: 'clinician',
    title: 'Clinician (Supervisor)',
  },
  {
    id: 'u-admin',
    email: 'alex.admin@careflow.test',
    password: 'admin-pass-2026',
    name: 'Alex Morgan',
    role: 'admin',
    title: 'Practice Administrator',
  },
]

const publicUser = (u: User) => ({ id: u.id, email: u.email, name: u.name, role: u.role, title: u.title })

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------
const DATA_DIR = path.resolve(process.cwd(), 'data')
const DB_FILE = path.join(DATA_DIR, 'db.json')
const COOKIE = 'careflow_sid'
const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30 // 30 days

function minutesAgo(m: number) {
  return new Date(Date.now() - m * 60_000).toISOString()
}

function seedRequests(): CareRequest[] {
  // Only *decided* history, so the review queue starts empty and the live demo item stands out.
  return [
    {
      id: 'RQ-1001',
      patientId: 'u-other-1',
      patientName: 'Jordan Lee',
      type: 'appointment',
      subject: 'Follow-up after blood test',
      details: 'Would like to discuss cholesterol results.',
      urgency: 'routine',
      status: 'approved',
      createdAt: minutesAgo(60 * 50),
      decidedAt: minutesAgo(60 * 49),
      reviewerName: 'Dr. Sam Rivera',
      reviewNote: 'Booked for Thursday 10:00.',
    },
    {
      id: 'RQ-1002',
      patientId: 'u-patient',
      patientName: 'Maya Patel',
      type: 'refill',
      subject: 'Lisinopril 10 mg',
      details: '30-day supply, same dosage as before.',
      urgency: 'routine',
      status: 'approved',
      createdAt: minutesAgo(60 * 30),
      decidedAt: minutesAgo(60 * 29 + 20),
      reviewerName: 'Dr. Sam Rivera',
      reviewNote: 'Approved. Please book a BP check next month.',
    },
    {
      id: 'RQ-1003',
      patientId: 'u-other-2',
      patientName: 'Priya Shah',
      type: 'referral',
      subject: 'Dermatology referral',
      details: 'Persistent rash on forearm for 3 weeks.',
      urgency: 'routine',
      status: 'rejected',
      createdAt: minutesAgo(60 * 6),
      decidedAt: minutesAgo(60 * 5),
      reviewerName: 'Dr. Sam Rivera',
      reviewNote: 'Please book an in-person GP visit first.',
    },
  ]
}

function freshDb(sessions: Db['sessions'] = {}): Db {
  return {
    nextRequestNumber: 1004,
    nextAuditId: 2,
    requests: seedRequests(),
    audit: [
      { id: 1, at: new Date().toISOString(), actorName: 'System', actorRole: 'system', action: 'reset', detail: 'Demo data seeded' },
    ],
    sessions,
  }
}

function loadDb(): Db {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) as Db
  } catch {
    const db = freshDb()
    saveDb(db)
    return db
  }
}

function saveDb(db: Db) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  const tmp = DB_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2))
  fs.renameSync(tmp, DB_FILE)
}

function audit(db: Db, actor: User | null, action: AuditEvent['action'], detail: string, requestId?: string) {
  db.audit.unshift({
    id: db.nextAuditId++,
    at: new Date().toISOString(),
    actorName: actor?.name ?? 'System',
    actorRole: actor?.role ?? 'system',
    action,
    requestId,
    detail,
  })
  db.audit = db.audit.slice(0, 200)
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers })
  res.end(JSON.stringify(body))
}

async function readJson(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  if (!chunks.length) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new HttpError(400, 'Invalid JSON body')
  }
}

function getCookie(req: IncomingMessage, name: string) {
  const header = req.headers.cookie ?? ''
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return undefined
}

function currentUser(db: Db, req: IncomingMessage): User | null {
  const sid = getCookie(req, COOKIE)
  const session = sid ? db.sessions[sid] : undefined
  return session ? USERS.find((u) => u.id === session.userId) ?? null : null
}

function requireUser(db: Db, req: IncomingMessage, ...roles: Role[]): User {
  const user = currentUser(db, req)
  if (!user) throw new HttpError(401, 'Not signed in')
  if (roles.length && !roles.includes(user.role)) throw new HttpError(403, `This action requires role: ${roles.join(' or ')}`)
  return user
}

function canSee(user: User, r: CareRequest) {
  return user.role !== 'patient' || r.patientId === user.id
}

const TYPE_LABEL: Record<RequestType, string> = {
  refill: 'Prescription refill',
  appointment: 'Appointment',
  referral: 'Specialist referral',
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const p = url.pathname
  const m = req.method ?? 'GET'
  const db = loadDb()

  // --- auth ---------------------------------------------------------------
  if (p === '/api/login' && m === 'POST') {
    const { email, password } = await readJson(req)
    const user = USERS.find((u) => u.email.toLowerCase() === String(email ?? '').trim().toLowerCase())
    if (!user || user.password !== password) throw new HttpError(401, 'Invalid email or password')
    const sid = crypto.randomBytes(24).toString('hex')
    db.sessions[sid] = { userId: user.id, createdAt: new Date().toISOString() }
    audit(db, user, 'login', `${user.name} signed in`)
    saveDb(db)
    return send(res, 200, { user: publicUser(user) }, {
      'Set-Cookie': `${COOKIE}=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_S}`,
    })
  }

  if (p === '/api/logout' && m === 'POST') {
    const sid = getCookie(req, COOKIE)
    const user = currentUser(db, req)
    if (sid) delete db.sessions[sid]
    if (user) audit(db, user, 'logout', `${user.name} signed out`)
    saveDb(db)
    return send(res, 200, { ok: true }, { 'Set-Cookie': `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` })
  }

  if (p === '/api/me' && m === 'GET') {
    const user = requireUser(db, req)
    return send(res, 200, { user: publicUser(user) })
  }

  // --- requests -----------------------------------------------------------
  if (p === '/api/requests' && m === 'GET') {
    const user = requireUser(db, req)
    const list = db.requests.filter((r) => canSee(user, r)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return send(res, 200, { requests: list })
  }

  if (p === '/api/requests' && m === 'POST') {
    const user = requireUser(db, req, 'patient')
    const body = await readJson(req)
    const type = body.type as RequestType
    const subject = String(body.subject ?? '').trim()
    const details = String(body.details ?? '').trim()
    const urgency = body.urgency === 'urgent' ? 'urgent' : 'routine'
    if (!TYPE_LABEL[type]) throw new HttpError(400, 'Choose a request type')
    if (subject.length < 3) throw new HttpError(400, 'Subject must be at least 3 characters')
    const r: CareRequest = {
      id: `RQ-${db.nextRequestNumber++}`,
      patientId: user.id,
      patientName: user.name,
      type,
      subject,
      details,
      urgency,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
    db.requests.push(r)
    audit(db, user, 'submitted', `${TYPE_LABEL[type]} "${subject}" submitted for review`, r.id)
    saveDb(db)
    return send(res, 201, { request: r })
  }

  const one = p.match(/^\/api\/requests\/(RQ-\d+)$/)
  if (one && m === 'GET') {
    const user = requireUser(db, req)
    const r = db.requests.find((x) => x.id === one[1])
    if (!r) throw new HttpError(404, 'Request not found')
    if (!canSee(user, r)) throw new HttpError(403, 'You can only view your own requests')
    return send(res, 200, { request: r, history: db.audit.filter((e) => e.requestId === r.id).reverse() })
  }

  const decide = p.match(/^\/api\/requests\/(RQ-\d+)\/decision$/)
  if (decide && m === 'POST') {
    const user = requireUser(db, req, 'clinician')
    const r = db.requests.find((x) => x.id === decide[1])
    if (!r) throw new HttpError(404, 'Request not found')
    if (r.status !== 'pending') throw new HttpError(409, `Request ${r.id} was already ${r.status}`)
    const { decision, note } = await readJson(req)
    if (decision !== 'approved' && decision !== 'rejected') throw new HttpError(400, 'Decision must be approved or rejected')
    const trimmed = String(note ?? '').trim()
    if (decision === 'rejected' && !trimmed) throw new HttpError(400, 'A note is required when rejecting')
    r.status = decision
    r.decidedAt = new Date().toISOString()
    r.reviewerName = user.name
    r.reviewNote = trimmed || undefined
    audit(db, user, decision, `${r.id} ${decision}${trimmed ? `: "${trimmed}"` : ''}`, r.id)
    saveDb(db)
    return send(res, 200, { request: r })
  }

  // --- admin --------------------------------------------------------------
  if (p === '/api/admin/summary' && m === 'GET') {
    requireUser(db, req, 'admin')
    const decided = db.requests.filter((r) => r.decidedAt)
    const turnaroundsMin = decided.map((r) => (Date.parse(r.decidedAt!) - Date.parse(r.createdAt)) / 60_000)
    const avg = turnaroundsMin.length ? turnaroundsMin.reduce((a, b) => a + b, 0) / turnaroundsMin.length : null
    const latestDecided = [...decided].sort((a, b) => b.decidedAt!.localeCompare(a.decidedAt!))[0] ?? null
    return send(res, 200, {
      counts: {
        total: db.requests.length,
        pending: db.requests.filter((r) => r.status === 'pending').length,
        approved: db.requests.filter((r) => r.status === 'approved').length,
        rejected: db.requests.filter((r) => r.status === 'rejected').length,
      },
      avgTurnaroundMinutes: avg,
      latestDecided,
      latestDecidedHistory: latestDecided ? db.audit.filter((e) => e.requestId === latestDecided.id).reverse() : [],
      requests: [...db.requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      audit: db.audit.slice(0, 30),
    })
  }

  if (p === '/api/admin/reset' && m === 'POST') {
    const user = requireUser(db, req, 'admin')
    // Keep login sessions so every role's saved browser session stays valid.
    const next = freshDb(db.sessions)
    audit(next, user, 'reset', `${user.name} reset the demo data`)
    saveDb(next)
    return send(res, 200, { ok: true })
  }

  throw new HttpError(404, `No route for ${m} ${p}`)
}

export function careflowApi(): Plugin {
  return {
    name: 'careflow-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        handle(req, res).catch((err) => {
          const status = err instanceof HttpError ? err.status : 500
          if (status === 500) console.error(err)
          send(res, status, { error: err.message ?? 'Server error' })
        })
      })
    },
  }
}
