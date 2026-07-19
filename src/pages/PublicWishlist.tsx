import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EmojiPicker } from '../components/EmojiPicker'
import { ItemsClaimBoard, type ItemClaimRow } from '../components/ItemsClaimBoard'
import { ManualClaimBoard, type ManualClaimRow } from '../components/ManualClaimBoard'
import { RevealClaimsButton } from '../components/RevealClaimsButton'
import { useAuth } from '../context/AuthContext'
import {
  guestStorageKey,
  makeSessionToken,
  supabase,
} from '../lib/supabase'
import type { Guest, Wishlist, WishlistItem } from '../lib/types'

export function PublicWishlist() {
  const { slug } = useParams<{ slug: string }>()
  const { user } = useAuth()

  const [wishlist, setWishlist] = useState<Wishlist | null>(null)
  const [items, setItems] = useState<WishlistItem[]>([])
  const [takenEmojis, setTakenEmojis] = useState<string[]>([])
  const [guest, setGuest] = useState<Guest | null>(null)
  const [itemClaims, setItemClaims] = useState<ItemClaimRow[]>([])
  const [manualClaims, setManualClaims] = useState<ManualClaimRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [emojiError, setEmojiError] = useState<string | null>(null)
  const [emojiBusy, setEmojiBusy] = useState(false)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [claimsRevealed, setClaimsRevealed] = useState(false)
  const [revealLoading, setRevealLoading] = useState(false)
  const [revealError, setRevealError] = useState<string | null>(null)

  const isOwner = Boolean(user && wishlist && user.id === wishlist.owner_id)
  const needsEmoji = !isOwner && !guest && Boolean(wishlist)

  const loadClaims = useCallback(
    async (wishlistId: string, token: string | null, mode: Wishlist['mode']) => {
      if (mode === 'items') {
        const { data, error: err } = await supabase.rpc('get_public_item_claims', {
          p_wishlist_id: wishlistId,
          p_session_token: token,
        })
        if (err) throw new Error(err.message)
        setItemClaims(
          ((data as ItemClaimRow[]) ?? []).map((c) => ({
            ...c,
            claim_id: (c as ItemClaimRow & { claim_id?: string }).claim_id,
          })),
        )
      } else {
        const { data, error: err } = await supabase.rpc('get_public_manual_claims', {
          p_wishlist_id: wishlistId,
          p_session_token: token,
        })
        if (err) throw new Error(err.message)
        setManualClaims((data as ManualClaimRow[]) ?? [])
      }
    },
    [],
  )

  useEffect(() => {
    if (!slug) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const { data: w, error: wErr } = await supabase
        .from('wishlists')
        .select('*')
        .eq('slug', slug)
        .maybeSingle()

      if (cancelled) return
      if (wErr || !w) {
        setError(wErr?.message ?? 'Вишлист не найден')
        setLoading(false)
        return
      }

      const list = w as Wishlist
      setWishlist(list)

      const { data: guests } = await supabase
        .from('guests')
        .select('emoji')
        .eq('wishlist_id', list.id)
      setTakenEmojis((guests ?? []).map((g) => g.emoji as string))

      if (list.mode === 'items') {
        const { data: its, error: iErr } = await supabase
          .from('wishlist_items')
          .select('*')
          .eq('wishlist_id', list.id)
          .order('sort_order')
        if (iErr) {
          setError(iErr.message)
          setLoading(false)
          return
        }
        setItems((its as WishlistItem[]) ?? [])
      }

      const stored = localStorage.getItem(guestStorageKey(list.id))
      setSessionToken(stored)

      const ownerView = Boolean(user && user.id === list.owner_id)

      if (stored && !ownerView) {
        const { data: g } = await supabase.rpc('get_guest_by_session', {
          p_wishlist_id: list.id,
          p_session_token: stored,
        })
        if (g) setGuest(g as Guest)
        try {
          await loadClaims(list.id, stored, list.mode)
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Ошибка загрузки броней')
        }
      } else if (!ownerView) {
        try {
          await loadClaims(list.id, null, list.mode)
        } catch {
          /* empty for new */
        }
      }

      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [slug, user, loadClaims])

  async function pickEmoji(emoji: string) {
    if (!wishlist) return
    setEmojiBusy(true)
    setEmojiError(null)

    const token = sessionToken ?? makeSessionToken()
    const { data, error: err } = await supabase.rpc('register_guest', {
      p_wishlist_id: wishlist.id,
      p_emoji: emoji,
      p_session_token: token,
    })

    if (err) {
      setEmojiError(
        err.message.includes('already taken') || err.message.includes('Emoji already')
          ? 'Этот эмодзи уже занят'
          : err.message,
      )
      setEmojiBusy(false)
      return
    }

    localStorage.setItem(guestStorageKey(wishlist.id), token)
    setSessionToken(token)
    setGuest(data as Guest)
    setTakenEmojis((prev) => (prev.includes(emoji) ? prev : [...prev, emoji]))
    setEmojiBusy(false)

    try {
      await loadClaims(wishlist.id, token, wishlist.mode)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    }
  }

  async function confirmItems(itemIds: string[]) {
    if (!wishlist || !sessionToken) return
    const { error: err } = await supabase.rpc('claim_items', {
      p_wishlist_id: wishlist.id,
      p_session_token: sessionToken,
      p_item_ids: itemIds,
    })
    if (err) throw new Error(translateClaimError(err.message))
    await loadClaims(wishlist.id, sessionToken, 'items')
  }

  async function releaseItems(itemIds?: string[]) {
    if (!wishlist || !sessionToken) return
    const { error: err } = await supabase.rpc('release_claims', {
      p_wishlist_id: wishlist.id,
      p_session_token: sessionToken,
      p_item_ids: itemIds ?? null,
    })
    if (err) throw new Error(err.message)
    await loadClaims(wishlist.id, sessionToken, 'items')
  }

  async function addManual(title: string) {
    if (!wishlist || !sessionToken) return
    const { error: err } = await supabase.rpc('add_manual_claim', {
      p_wishlist_id: wishlist.id,
      p_session_token: sessionToken,
      p_title: title,
    })
    if (err) throw new Error(err.message)
    await loadClaims(wishlist.id, sessionToken, 'link')
  }

  async function removeManual(claimId: string) {
    if (!wishlist || !sessionToken) return
    const { error: err } = await supabase.rpc('remove_manual_claim', {
      p_wishlist_id: wishlist.id,
      p_session_token: sessionToken,
      p_claim_id: claimId,
    })
    if (err) throw new Error(err.message)
    await loadClaims(wishlist.id, sessionToken, 'link')
  }

  async function toggleOwnerReveal() {
    if (!wishlist || !isOwner) return

    if (claimsRevealed) {
      setClaimsRevealed(false)
      setItemClaims([])
      setManualClaims([])
      setRevealError(null)
      return
    }

    setRevealLoading(true)
    setRevealError(null)

    if (wishlist.mode === 'items') {
      const { data, error: err } = await supabase.rpc('get_claims_for_owner', {
        p_wishlist_id: wishlist.id,
      })
      if (err) {
        setRevealError(err.message)
        setRevealLoading(false)
        return
      }
      setItemClaims(
        ((data as Array<{ claim_id: string; item_id: string; guest_id: string; emoji: string }>) ??
          []).map((c) => ({
          claim_id: c.claim_id,
          item_id: c.item_id,
          guest_id: c.guest_id,
          emoji: c.emoji,
          is_mine: false,
        })),
      )
    } else {
      const { data, error: err } = await supabase.rpc('get_manual_claims_for_owner', {
        p_wishlist_id: wishlist.id,
      })
      if (err) {
        setRevealError(err.message)
        setRevealLoading(false)
        return
      }
      setManualClaims(
        ((data as Array<{
          claim_id: string
          title: string
          guest_id: string
          emoji: string
        }>) ?? []).map((c) => ({
          claim_id: c.claim_id,
          title: c.title,
          guest_id: c.guest_id,
          emoji: c.emoji,
          is_mine: false,
        })),
      )
    }

    setClaimsRevealed(true)
    setRevealLoading(false)
  }

  const subtitle = useMemo(() => {
    if (!wishlist) return ''
    return wishlist.mode === 'items'
      ? 'Отметь, что купишь, и подтверди'
      : 'Открой ссылку и напиши ниже, что берёшь'
  }, [wishlist])

  if (loading) {
    return (
      <div className="page-center">
        <p className="muted">Загрузка вишлиста…</p>
      </div>
    )
  }

  if (!wishlist) {
    return (
      <div className="panel">
        <h1 className="page-title">Не найдено</h1>
        <p className="error">{error ?? 'Такого вишлиста нет'}</p>
        <Link to="/">На главную</Link>
      </div>
    )
  }

  return (
    <div>
      <header className="wishlist-header">
        <h1>{wishlist.title}</h1>
        <p className="muted">{subtitle}</p>
        <div className="wishlist-toolbar">
          {guest && (
            <span className="guest-badge">
              Ты: <span style={{ fontSize: '1.2rem' }}>{guest.emoji}</span>
            </span>
          )}
          {isOwner && (
            <>
              <span className="guest-badge">Ты владелец</span>
              <Link className="btn btn-xs btn-secondary" to={`/wishlist/${wishlist.slug}/edit`}>
                Редактировать
              </Link>
              <RevealClaimsButton
                open={claimsRevealed}
                loading={revealLoading}
                onToggle={() => void toggleOwnerReveal()}
              />
            </>
          )}
        </div>
      </header>

      {error && <p className="error">{error}</p>}
      {revealError && <p className="error">{revealError}</p>}

      {isOwner && (
        <p className="muted" style={{ marginBottom: '1rem' }}>
          {claimsRevealed
            ? 'Брони видны на списке — у занятых позиций стоит эмодзи друга.'
            : 'Брони скрыты. Нажми «Показать брони», чтобы увидеть эмодзи на подарках.'}
        </p>
      )}

      {wishlist.mode === 'items' ? (
        <ItemsClaimBoard
          items={items}
          claims={isOwner && !claimsRevealed ? [] : itemClaims}
          canInteract={!isOwner && Boolean(guest)}
          onConfirm={confirmItems}
          onRelease={releaseItems}
        />
      ) : (
        <ManualClaimBoard
          claims={isOwner && !claimsRevealed ? [] : manualClaims}
          cartUrl={wishlist.cart_url ?? '#'}
          canInteract={!isOwner && Boolean(guest)}
          hideEmpty={isOwner && !claimsRevealed}
          onAdd={addManual}
          onRemove={removeManual}
        />
      )}

      {needsEmoji && (
        <EmojiPicker
          taken={takenEmojis}
          onPick={pickEmoji}
          busy={emojiBusy}
          error={emojiError}
        />
      )}
    </div>
  )
}

function translateClaimError(message: string): string {
  if (message.toLowerCase().includes('already claimed')) {
    return 'Кто-то уже занял этот товар — обнови страницу'
  }
  return message
}
