import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import styles from './Sidebar.module.css';
import {
  LayoutDashboard, Upload, ClipboardList,
  Settings, LogOut, Database, ChevronRight, TrendingUp,
  Menu, X, CheckCircle2,
} from 'lucide-react';

const getNavItems = (role) => {
  const items = [
    { to: '/dashboard',  label: 'Dashboard',    icon: LayoutDashboard },
    { to: '/upload',     label: 'Upload Data',  icon: Upload          },
    { to: '/etl-status', label: 'ETL Status',   icon: Database        },
    { to: '/forecast',   label: 'Forecast',     icon: TrendingUp      },
    { to: '/evaluation', label: 'Evaluation',   icon: CheckCircle2    },
  ];
  if (role === 'admin') {
    items.push({ to: '/admin', label: 'Admin Panel', icon: ClipboardList });
  }
  return items;
};

export default function Sidebar() {
  const { user, logout }      = useAuth();
  const navigate              = useNavigate();
  const location              = useLocation();
  const [open, setOpen]       = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => { setOpen(false); }, [location.pathname]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };
  const navItems     = getNavItems(user?.role);

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        className={styles.hamburger}
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close menu' : 'Open menu'}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Backdrop (mobile only) */}
      {open && <div className={styles.backdrop} onClick={() => setOpen(false)} />}

      <aside className={`${styles.sidebar} ${open ? styles.sidebarOpen : ''}`}>
        {/* Logo */}
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <Database size={20} color="#fff" />
          </div>
          <div>
            <div className={styles.logoTitle}>SalesETL</div>
            <div className={styles.logoSub}>Analytics Platform</div>
          </div>
        </div>

        {/* Nav */}
        <nav className={styles.nav}>
          <p className={styles.navLabel}>MAIN MENU</p>
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.active : ''}`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
              <ChevronRight size={14} className={styles.chevron} />
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className={styles.footer}>
          <div className={styles.userInfo}>
            <div className={styles.avatar}>
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <div className={styles.userName}>{user?.username || 'User'}</div>
              <div className={styles.userRole}>{user?.role || 'user'}</div>
            </div>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout} title="Logout">
            <LogOut size={16} />
          </button>
        </div>
      </aside>
    </>
  );
}
