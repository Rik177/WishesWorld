import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { makeSlug, supabase } from '../lib/supabase'
import type { DraftItem, WishlistMode } from '../lib/types'

export function CreateWishlist() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<WishlistMode | null>(null)
  const [title, setTitle] = useState('')
  const [cartUrl, setCartUrl] = useState('')
  const [items, setItems] = useState<DraftItem[]>([{ title: '', url: '' }])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  }

  function addItem() {
    setItems((prev) => [...prev, { title: '', url: '' }])
  }

  function removeItem(index: number) {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user || !mode) return
    setError(null)
    setBusy(true)

    const slug = makeSlug(8)
    const payload = {
      owner_id: user.id,
      title: title.trim(),
      slug,
      mode,
      cart_url: mode === 'link' ? cartUrl.trim() : null,
    }

    const { data: wishlist, error: wErr } = await supabase
      .from('wishlists')
      .insert(payload)
      .select()
      .single()

    if (wErr || !wishlist) {
      setError(wErr?.message ?? 'Не удалось создать вишлист')
      setBusy(false)
      return
    }

    if (mode === 'items') {
      const cleaned = items
        .map((it, i) => ({
          wishlist_id: wishlist.id,
          title: it.title.trim(),
          url: it.url.trim() || null,
          sort_order: i,
        }))
        .filter((it) => it.title.length > 0)

      if (cleaned.length === 0) {
        await supabase.from('wishlists').delete().eq('id', wishlist.id)
        setError('Добавь хотя бы один товар')
        setBusy(false)
        return
      }

      const { error: iErr } = await supabase.from('wishlist_items').insert(cleaned)
      if (iErr) {
        await supabase.from('wishlists').delete().eq('id', wishlist.id)
        setError(iErr.message)
        setBusy(false)
        return
      }
    }

    setBusy(false)
    navigate(`/wishlist/${slug}/edit`)
  }

  if (!mode) {
    return (
      <div>
        <h1 className="page-title">Новый вишлист</h1>
        <p className="page-lead">Как хочешь оформить желания?</p>
        <div className="mode-grid">
          <button type="button" className="mode-option" onClick={() => setMode('items')}>
            <h3>Список товаров</h3>
            <p>Добавь позиции со ссылками — друзья отметят, что берут.</p>
          </button>
          <button type="button" className="mode-option" onClick={() => setMode('link')}>
            <h3>Ссылка на корзину</h3>
            <p>Одна общая ссылка — друзья сами напишут, что купят.</p>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="panel">
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode(null)}>
        ← Сменить тип
      </button>
      <h1 className="page-title" style={{ marginTop: '0.75rem' }}>
        {mode === 'items' ? 'Список товаров' : 'Ссылка на корзину'}
      </h1>
      <p className="page-lead">Заполни детали — потом можно будет отредактировать.</p>

      <form className="form" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="title">Название</label>
          <input
            id="title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="День рождения Ярика"
          />
        </div>

        {mode === 'link' ? (
          <div className="field">
            <label htmlFor="cart">Ссылка на корзину / подборку</label>
            <input
              id="cart"
              type="url"
              required
              value={cartUrl}
              onChange={(e) => setCartUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
        ) : (
          <div className="item-editor">
            <strong>Товары</strong>
            {items.map((it, index) => (
              <div className="item-editor-row" key={index}>
                <input
                  required
                  value={it.title}
                  onChange={(e) => updateItem(index, { title: e.target.value })}
                  placeholder="Название подарка"
                />
                <input
                  type="url"
                  value={it.url}
                  onChange={(e) => updateItem(index, { url: e.target.value })}
                  placeholder="https://ссылка на товар"
                />
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => removeItem(index)}
                  disabled={items.length === 1}
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

        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Создаём…' : 'Создать вишлист'}
        </button>
      </form>
    </div>
  )
}
