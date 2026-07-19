import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function Landing() {
  const { user } = useAuth()

  return (
    <section className="hero-landing">
      <p className="brand-mark" style={{ fontSize: '1rem', margin: 0 }}>
        для друзей · без спойлеров
      </p>
      <h1 className="hero-brand">WishesWorld</h1>
      <h2 className="hero-title">Мир желаний, где подарки не пересекаются</h2>
      <p className="hero-sub">
        Создай вишлист, поделись ссылкой — друзья выберут эмодзи и отметят, что купят.
      </p>
      <div className="cta-row">
        {user ? (
          <>
            <Link className="btn btn-primary" to="/wishlist/new">
              Создать вишлист
            </Link>
            <Link className="btn btn-secondary" to="/dashboard">
              Мои вишлисты
            </Link>
          </>
        ) : (
          <>
            <Link className="btn btn-primary" to="/auth?mode=signup">
              Создать вишлист
            </Link>
            <Link className="btn btn-secondary" to="/auth">
              Войти
            </Link>
          </>
        )}
      </div>
    </section>
  )
}
