import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import type { Wishlist, WishlistItem } from '../lib/types'

export function EditWishlist() {
  const { slug } = useParams<{ slug: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [wishlist, setWishlist] = useState<Wishlist | null>(null)
  const [items, setItems] = useState<WishlistItem[]>([])
  const [title, setTitle] = useState('')
  const [cartUrl, setCartUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!slug || !user) return
    let cancelled = false

    async function load() {
      setLoading(true)
      const { data: w, error: wErr } = await supabase
        .from('wishlists')
        .select('*')
        .eq('slug', slug)
        .eq('owner_id', user!.id)
        .maybeSingle()

      if (cancelled) return
      if (wErr || !w) {
        setError(wErr?.message ?? 'Вишлист не найден')
        setLoading(false)
        return
      }

      setWishlist(w as Wishlist)
      setTitle(w.title)
      setCartUrl(w.cart_url ?? '')

      if (w.mode === 'items') {
        const { data: its, error: iErr } = await supabase
          .from('wishlist_items')
          .select('*')
          .eq('wishlist_id', w.id)
          .order('sort_order')

        if (iErr) setError(iErr.message)
        else setItems((its as WishlistItem[]) ?? [])
      }

      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [slug, user])

  function updateItem(id: string, patch: Partial<WishlistItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }

  async function addItem() {
    if (!wishlist) return
    const { data, error: err } = await supabase
      .from('wishlist_items')
      .insert({
        wishlist_id: wishlist.id,
        title: 'Новый товар',
        url: null,
        sort_order: items.length,
      })
      .select()
      .single()

    if (err) setError(err.message)
    else if (data) setItems((prev) => [...prev, data as WishlistItem])
  }

  async function removeItem(id: string) {
    const { error: err } = await supabase.from('wishlist_items').delete().eq('id', id)
    if (err) setError(err.message)
    else setItems((prev) => prev.filter((it) => it.id !== id))
  }

  async function onSave(e: FormEvent) {
    e.preventDefault()
    if (!wishlist) return
    setBusy(true)
    setError(null)
    setSaved(false)

    const { error: wErr } = await supabase
      .from('wishlists')
      .update({
        title: title.trim(),
        cart_url: wishlist.mode === 'link' ? cartUrl.trim() : null,
      })
      .eq('id', wishlist.id)

    if (wErr) {
      setError(wErr.message)
      setBusy(false)
      return
    }

    if (wishlist.mode === 'items') {
      for (const it of items) {
        const { error: iErr } = await supabase
          .from('wishlist_items')
          .update({
            title: it.title.trim(),
            url: it.url?.trim() || null,
          })
          .eq('id', it.id)
        if (iErr) {
          setError(iErr.message)
          setBusy(false)
          return
        }
      }
    }

    setSaved(true)
    setBusy(false)
  }

  async function onDelete() {
    if (!wishlist) return
    if (!confirm('Удалить вишлист навсегда?')) return
    const { error: err } = await supabase.from('wishlists').delete().eq('id', wishlist.id)
    if (err) setError(err.message)
    else navigate('/dashboard')
  }

  async function copyLink() {
    if (!wishlist) return
    await navigator.clipboard.writeText(`${window.location.origin}/w/${wishlist.slug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  if (loading) {
    return (
      <div className="page-center">
        <p className="muted">Загрузка…</p>
      </div>
    )
  }

  if (!wishlist) {
    return (
      <div className="panel">
        <p className="error">{error ?? 'Не найдено'}</p>
        <Link to="/dashboard">К списку</Link>
      </div>
    )
  }

  return (
    <div className="panel">
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="page-title">Редактирование</h1>
        </div>
        <div className="row-actions">
          <Link className="btn btn-xs btn-secondary" to={`/w/${wishlist.slug}`}>
            Открыть
          </Link>
          <button type="button" className="btn btn-xs btn-ghost" onClick={copyLink}>
            {copied ? 'Скопировано!' : 'Копировать ссылку'}
          </button>
        </div>
      </div>

      <form className="form" onSubmit={onSave} style={{ marginTop: '1.25rem' }}>
        <div className="field">
          <label htmlFor="title">Название</label>
          <input
            id="title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {wishlist.mode === 'link' ? (
          <div className="field">
            <label htmlFor="cart">Ссылка</label>
            <input
              id="cart"
              type="url"
              required
              value={cartUrl}
              onChange={(e) => setCartUrl(e.target.value)}
            />
          </div>
        ) : (
          <div className="item-editor">
            <strong>Товары</strong>
            {items.map((it) => (
              <div className="item-editor-row" key={it.id}>
                <input
                  required
                  value={it.title}
                  onChange={(e) => updateItem(it.id, { title: e.target.value })}
                  placeholder="Название подарка"
                />
                <input
                  type="url"
                  value={it.url ?? ''}
                  onChange={(e) => updateItem(it.id, { url: e.target.value })}
                  placeholder="https://ссылка на товар"
                />
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => removeItem(it.id)}
                  aria-label="Удалить товар"
                  title="Удалить"
                >
                  ×
                </button>
              </div>
            ))}
            <button type="button" className="btn-add" onClick={addItem}>
              + Добавить подарок
            </button>
          </div>
        )}

        {error && <p className="error">{error}</p>}
        {saved && <p className="success">Сохранено</p>}

        <div className="claim-actions">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Сохраняем…' : 'Сохранить'}
          </button>
          <button type="button" className="btn btn-danger" onClick={onDelete}>
            Удалить вишлист
          </button>
        </div>
      </form>
    </div>
  )
}
