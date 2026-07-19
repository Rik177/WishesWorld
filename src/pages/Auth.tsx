import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function Auth() {
  const { user, loading, signIn, signUp } = useAuth()
  const [params] = useSearchParams()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'

  const [mode, setMode] = useState<'login' | 'signup'>(
    params.get('mode') === 'signup' ? 'signup' : 'login',
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!loading && user) {
    return <Navigate to={from} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)

    if (mode === 'login') {
      const err = await signIn(email.trim(), password)
      if (err) setError(translateAuthError(err))
    } else {
      const err = await signUp(email.trim(), password, displayName.trim())
      if (err) {
        setError(translateAuthError(err))
      } else {
        setInfo(
          'Аккаунт создан. Если включено подтверждение email — проверь почту, иначе можно сразу пользоваться.',
        )
      }
    }
    setBusy(false)
  }

  return (
    <div className="panel" style={{ maxWidth: 440, margin: '2rem auto' }}>
      <h1 className="page-title">{mode === 'login' ? 'Вход' : 'Регистрация'}</h1>
      <p className="page-lead">
        {mode === 'login'
          ? 'Войди, чтобы управлять своими вишлистами.'
          : 'Нужен аккаунт, чтобы создавать вишлисты.'}
      </p>

      <div className="tabs">
        <button
          type="button"
          className={`tab ${mode === 'login' ? 'active' : ''}`}
          onClick={() => setMode('login')}
        >
          Вход
        </button>
        <button
          type="button"
          className={`tab ${mode === 'signup' ? 'active' : ''}`}
          onClick={() => setMode('signup')}
        >
          Регистрация
        </button>
      </div>

      <form className="form" onSubmit={onSubmit}>
        {mode === 'signup' && (
          <div className="field">
            <label htmlFor="name">Имя</label>
            <input
              id="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Как тебя зовут"
              autoComplete="nickname"
            />
          </div>
        )}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@mail.com"
            autoComplete="email"
          />
        </div>
        <div className="field">
          <label htmlFor="password">Пароль</label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="минимум 6 символов"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </div>

        {error && <p className="error">{error}</p>}
        {info && <p className="success">{info}</p>}

        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
        </button>
      </form>

      <p className="muted" style={{ marginTop: '1.25rem', marginBottom: 0 }}>
        <Link to="/">← На главную</Link>
      </p>
    </div>
  )
}

function translateAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login')) return 'Неверный email или пароль'
  if (m.includes('already registered')) return 'Этот email уже зарегистрирован'
  if (m.includes('password')) return 'Пароль слишком короткий или слабый'
  if (m.includes('email')) return 'Проверь формат email'
  return message
}
