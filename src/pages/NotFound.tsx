import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <section className="card empty">
      <h1>Page not found</h1>
      <p><Link to="/">Back to your dashboard</Link></p>
    </section>
  )
}
