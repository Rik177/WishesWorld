import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import type { Wishlist } from '../lib/types'

export function Dashboard() {
  const { user } = useAuth()
  const [lists, setLists] = useState<Wishlist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function load() {
      setLoading(true)
      const { data, error: err } = await supabase
        .from('wishlists')
        .select('*')
        .eq('owner_id', user!.id)
        .order('created_at', { ascending: false })

      if (cancelled) return
      if (err) setError(err.message)
      else setLists((data as Wishlist[]) ?? [])
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user])

  async function copyLink(slug: string) {
    const url = `${window.location.origin}/w/${slug}`
    await navigator.clipboard.writeText(url)
    setCopied(slug)
    setTimeout(() => setCopied(null), 1600)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Мои вишлисты</h1>
          <p className="page-lead" style={{ marginBottom: 0 }}>
            Создавай списки и делись ссылкой с друзьями.
          </p>
        </div>
        <Link className="btn btn-primary" to="/wishlist/new">
          Новый вишлист
        </Link>
      </div>

      {loading && <p className="muted">Загрузка…</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && lists.length === 0 && (
        <div className="empty">
          Пока пусто. Создай первый вишлист — это займёт минуту.
        </div>
      )}

      <div className="list">
        {lists.map((w) => (
          <div className="list-row" key={w.id}>
            <div>
              <h3>{w.title}</h3>
              <p>
                {w.mode === 'items' ? 'Список товаров' : 'Ссылка на корзину'}
              </p>
            </div>
            <div className="row-actions">
              <Link className="btn btn-xs btn-secondary" to={`/w/${w.slug}`}>
                Открыть
              </Link>
              <Link className="btn btn-xs btn-secondary" to={`/wishlist/${w.slug}/edit`}>
                Изменить
              </Link>
              <button
                type="button"
                className="btn btn-xs btn-ghost"
                onClick={() => copyLink(w.slug)}
              >
                {copied === w.slug ? 'Скопировано!' : 'Копировать ссылку'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
