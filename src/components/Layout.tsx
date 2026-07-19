import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth()

  return (
    <div className="app-shell">
      <header className="topbar">
        
        <Link to="/" className="brand-mark">
          <img className='logo' src="/favicon.svg" alt="" />
          <span>WishesWorld</span>
        </Link>
        <nav className="topnav">
          {user ? (
            <>
              <NavLink to="/dashboard">Мои вишлисты</NavLink>
              <NavLink to="/wishlist/new">Создать</NavLink>
              <button type="button" className="linkish" onClick={() => signOut()}>
                Выйти
              </button>
            </>
          ) : (
            <NavLink to="/auth">Войти</NavLink>
          )}
        </nav>
      </header>
      <main className="main">{children}</main>
    </div>
  )
}
