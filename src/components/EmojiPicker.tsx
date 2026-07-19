import { useState } from 'react'
import { EMOJI_POOL } from '../lib/types'

interface Props {
  taken: string[]
  onPick: (emoji: string) => Promise<void> | void
  busy?: boolean
  error?: string | null
}

export function EmojiPicker({ taken, onPick, busy, error }: Props) {
  const [picked, setPicked] = useState<string | null>(null)

  async function handlePick(emoji: string) {
    if (taken.includes(emoji) || busy) return
    setPicked(emoji)
    await onPick(emoji)
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-labelledby="emoji-title">
        <h2 id="emoji-title">Выбери эмодзи</h2>
        <p className="muted" style={{ marginBottom: 0 }}>
          Он закрепится за тобой в этом вишлисте — так друзья поймут, кто что берёт.
        </p>
        <div className="emoji-grid">
          {EMOJI_POOL.map((emoji) => {
            const isTaken = taken.includes(emoji)
            return (
              <button
                key={emoji}
                type="button"
                className={`emoji-btn ${picked === emoji ? 'picked' : ''}`}
                disabled={isTaken || busy}
                onClick={() => handlePick(emoji)}
                title={isTaken ? 'Уже занято' : emoji}
              >
                {emoji}
              </button>
            )
          })}
        </div>
        {error && <p className="error">{error}</p>}
        {busy && <p className="muted">Сохраняем…</p>}
      </div>
    </div>
  )
}
