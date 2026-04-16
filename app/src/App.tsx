import { Routes, Route } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import Callback from './auth/Callback'
import UnauthHome from './views/UnauthHome'
import AuthedHome from './views/AuthedHome'

function Home() {
  const { isAuthed, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="container">
        <div className="logo">◈</div>
        <p className="tagline">Loading…</p>
      </div>
    )
  }

  return isAuthed ? <AuthedHome /> : <UnauthHome />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/callback" element={<Callback />} />
    </Routes>
  )
}
