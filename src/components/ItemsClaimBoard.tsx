import { useMemo, useState } from 'react'
import type { WishlistItem } from '../lib/types'

export interface ItemClaimRow {
  claim_id: string
  item_id: string
  guest_id: string
  emoji: string
  is_mine: boolean
}

interface Props {
  items: WishlistItem[]
  claims: ItemClaimRow[]
  canInteract: boolean
  onConfirm: (itemIds: string[]) => Promise<void>
  onRelease: (itemIds?: string[]) => Promise<void>
}

export function ItemsClaimBoard({
  items,
  claims,
  canInteract,
  onConfirm,
  onRelease,
}: Props) {
  const claimByItem = useMemo(() => {
    const map = new Map<string, ItemClaimRow>()
    for (const c of claims) map.set(c.item_id, c)
    return map
  }, [claims])

  const myItemIds = useMemo(
    () => claims.filter((c) => c.is_mine).map((c) => c.item_id),
    [claims],
  )

  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState(false)

  function toggle(id: string) {
    const claim = claimByItem.get(id)
    if (claim && !claim.is_mine) return
    if (claim?.is_mine) return
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  async function confirm() {
    if (selected.length === 0) return
    setBusy(true)
    setError(null)
    try {
      await onConfirm(selected)
      setSelected([])
      setFlash(true)
      setTimeout(() => setFlash(false), 500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  async function releaseAll() {
    setBusy(true)
    setError(null)
    try {
      await onRelease()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={flash ? 'confirmed-flash' : undefined}>
      <div className="claim-list">
        {items.map((item) => {
          const claim = claimByItem.get(item.id)
          const isMine = claim?.is_mine
          const taken = Boolean(claim) && !isMine
          const isSelected = selected.includes(item.id)

          return (
            <div
              key={item.id}
              className={[
                'claim-item',
                canInteract && !taken && !isMine ? 'selectable' : '',
                isSelected ? 'selected' : '',
                taken ? 'taken' : '',
                isMine ? 'mine' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => {
                if (canInteract) toggle(item.id)
              }}
              role={canInteract && !taken && !isMine ? 'button' : undefined}
            >
              <span className={`emoji-tag ${claim ? 'emoji-revealed' : ''}`}>
                {claim ? claim.emoji : isSelected ? '✓' : '○'}
              </span>
              <div>
                <strong>{item.title}</strong>
                {item.url && (
                  <div>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Открыть ссылку
                    </a>
                  </div>
                )}
                {isMine && (
                  <div className="muted" style={{ fontSize: '0.85rem' }}>
                    Ты берёшь это
                  </div>
                )}
                {taken && (
                  <div className="muted" style={{ fontSize: '0.85rem' }}>
                    Уже занято
                  </div>
                )}
              </div>
              {isMine && canInteract && (
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={(e) => {
                    e.stopPropagation()
                    void onRelease([item.id])
                  }}
                >
                  Отменить
                </button>
              )}
            </div>
          )
        })}
      </div>

      {canInteract && (
        <div className="claim-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || selected.length === 0}
            onClick={() => void confirm()}
          >
            Подтвердить
          </button>
          {myItemIds.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => void releaseAll()}
            >
              Отменить мои брони
            </button>
          )}
        </div>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  )
}
