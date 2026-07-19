import { useState, type FormEvent } from 'react'

export interface ManualClaimRow {
  claim_id: string
  title: string
  guest_id: string
  emoji: string
  is_mine: boolean
}

interface Props {
  claims: ManualClaimRow[]
  cartUrl: string
  canInteract: boolean
  hideEmpty?: boolean
  onAdd: (title: string) => Promise<void>
  onRemove: (claimId: string) => Promise<void>
}

export function ManualClaimBoard({
  claims,
  cartUrl,
  canInteract,
  hideEmpty = false,
  onAdd,
  onRemove,
}: Props) {
  const [drafts, setDrafts] = useState<string[]>([''])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState(false)

  function updateDraft(index: number, value: string) {
    setDrafts((prev) => prev.map((d, i) => (i === index ? value : d)))
  }

  function addDraftRow() {
    setDrafts((prev) => [...prev, ''])
  }

  async function confirm(e: FormEvent) {
    e.preventDefault()
    const titles = drafts.map((d) => d.trim()).filter(Boolean)
    if (titles.length === 0) return

    setBusy(true)
    setError(null)
    try {
      for (const title of titles) {
        await onAdd(title)
      }
      setDrafts([''])
      setFlash(true)
      setTimeout(() => setFlash(false), 500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={flash ? 'confirmed-flash' : undefined}>
      <a className="cart-link" href={cartUrl} target="_blank" rel="noreferrer">
        Открыть ссылку на корзину 
        <img className="arrow-image" src="/arrow-narrow-left-svgrepo-com.svg" alt="" />
      </a>

      <div className="manual-table">
        {claims.length === 0 && !hideEmpty && (
          <div className="empty">
            {canInteract
              ? 'Пока никто ничего не отметил. Будь первым!'
              : 'Пока никто ничего не отметил.'}
          </div>
        )}
        {claims.map((c) => (
          <div className={`manual-row ${c.is_mine ? 'mine' : ''}`} key={c.claim_id}>
            <span className="emoji-tag">{c.emoji}</span>
            <span>{c.title}</span>
            {c.is_mine && canInteract && (
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => void onRemove(c.claim_id)}
              >
                Удалить
              </button>
            )}
            {!c.is_mine && <span />}
          </div>
        ))}
      </div>

      {canInteract && (
        <form className="manual-form" onSubmit={(e) => void confirm(e)}>
          <p className="manual-form-label">Напиши, что купишь из корзины</p>
          <div className="manual-compose-list">
            {drafts.map((draft, index) => (
              <div className="manual-compose" key={index}>
                <input
                  value={draft}
                  onChange={(e) => updateDraft(index, e.target.value)}
                  placeholder="Название подарка"
                />
                {index === drafts.length - 1 ? (
                  <button
                    type="button"
                    className="btn-add-round"
                    onClick={addDraftRow}
                    aria-label="Добавить ещё"
                    title="Ещё позицию"
                  >
                    +
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() =>
                      setDrafts((prev) => prev.filter((_, i) => i !== index))
                    }
                    aria-label="Убрать строку"
                    title="Убрать"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="claim-actions">
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Сохраняем…' : 'Подтвердить'}
            </button>
          </div>
        </form>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  )
}
