interface Props {
  open: boolean
  loading?: boolean
  onToggle: () => void
}

export function RevealClaimsButton({ open, loading, onToggle }: Props) {
  return (
    <button
      type="button"
      className="btn btn-secondary btn-xs"
      onClick={onToggle}
      disabled={loading}
    >
      {loading ? 'Загрузка…' : open ? 'Скрыть брони' : 'Показать брони'}
    </button>
  )
}
