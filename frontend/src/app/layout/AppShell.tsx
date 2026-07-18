import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { ROUTES } from '@/app/routing/routes';
import { PRIMARY_NAVIGATION } from '@/shared/config/navigation';
import styles from './AppShell.module.css';

function getNavClassName({ isActive }: { isActive: boolean }) {
  return isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink;
}

const PAGE_VERSION_LABELS: Record<string, string> = {
  [ROUTES.dashboard]: 'Dashboard v0.6',
  [ROUTES.scanner]: 'Scanner v0.1',
  [ROUTES.market]: 'Market v0.1',
  [ROUTES.workspace]: 'Workspace v0.1',
  [ROUTES.alerts]: 'Alerts v0.1',
  [ROUTES.marketHistory]: 'Market History v0.1',
  [ROUTES.replay]: 'Replay v0.1',
  [ROUTES.settings]: 'Settings v0.1',
};

const DASHBOARD_LINKS = [
  { label: 'DASHBOARD', path: ROUTES.dashboard, end: true },
  { label: 'SCANNER', path: ROUTES.scanner, end: false },
  { label: 'MARKET', path: ROUTES.market, end: false },
  { label: 'CHARTS', path: ROUTES.workspace, end: false },
  { label: 'AI ANALYSIS', path: ROUTES.alerts, end: false },
  { label: 'WATCHLIST', path: ROUTES.marketHistory, end: false },
  { label: 'SETTINGS', path: ROUTES.settings, end: false },
] as const;

const RAIL_LINKS = [
  { label: 'Dashboard', path: ROUTES.dashboard, icon: 'pulse', end: true },
  { label: 'Scanner', path: ROUTES.scanner, icon: 'search', end: false },
  { label: 'Market', path: ROUTES.market, icon: 'market', end: false },
  { label: 'Watchlist', path: ROUTES.marketHistory, icon: 'star', end: false },
  { label: 'Charts', path: ROUTES.workspace, icon: 'chart', end: false },
  { label: 'Alerts', path: ROUTES.alerts, icon: 'note', end: false },
  { label: 'Replay', path: ROUTES.replay, icon: 'robot', end: false },
  { label: 'Settings', path: ROUTES.settings, icon: 'settings', end: false },
] as const;

type RailIconName = (typeof RAIL_LINKS)[number]['icon'];

function RailIcon({ name }: { name: RailIconName }) {
  if (name === 'pulse') return <svg viewBox="0 0 24 24"><path d="M3 12h4l2.3-6 4.2 12 2.2-6H21" /></svg>;
  if (name === 'search') return <svg viewBox="0 0 24 24"><circle cx="10" cy="10" r="5.5" /><path d="m14.5 14.5 5 5" /></svg>;
  if (name === 'market') return <svg viewBox="0 0 24 24"><path d="M4 17 8.5 12.5l3 2.7L19.5 7" /><path d="M15 7h4.5v4.5" /></svg>;
  if (name === 'star') return <svg viewBox="0 0 24 24"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" /></svg>;
  if (name === 'chart') return <svg viewBox="0 0 24 24"><path d="M4 19V9m5 10V5m5 14v-7m5 7V3" /></svg>;
  if (name === 'note') return <svg viewBox="0 0 24 24"><rect x="5" y="3.5" width="14" height="17" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>;
  if (name === 'robot') return <svg viewBox="0 0 24 24"><path d="M9 5h6M12 2v3M5 9h14v9H5zM8 13h.1M16 13h.1M9 17h6" /></svg>;
  return <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.5" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1m9.2 9.2 2.1 2.1M18.7 5.3l-2.1 2.1m-9.2 9.2-2.1 2.1" /></svg>;
}

export function AppShell() {
  const location = useLocation();
  const isDashboard = location.pathname === ROUTES.dashboard;
  const pageVersion = PAGE_VERSION_LABELS[location.pathname] ?? 'NEXUS frontend';

  if (isDashboard) {
    return (
      <div className={styles.terminalShell}>
        <header className={styles.terminalTopbar}>
          <Link className={styles.terminalBrand} to={ROUTES.dashboard} aria-label="NEXUS Terminal">
            <span className={styles.terminalBrandMark}>N</span>
            <span><strong>NEXUS</strong><small>TERMINAL</small></span>
          </Link>

          <nav className={styles.terminalNavigation} aria-label="Навигация Dashboard">
            {DASHBOARD_LINKS.map((item) => (
              <NavLink
                key={item.label}
                to={item.path}
                end={item.end}
                className={({ isActive }) => isActive ? `${styles.terminalLink} ${styles.terminalLinkActive}` : styles.terminalLink}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className={styles.terminalStatus}>
            <span className={styles.live}><i />LIVE</span>
            <time>12:45:32 UTC+3</time>
            <span className={styles.topIcon} aria-label="Уведомления">♧</span>
            <span className={styles.topIcon} aria-label="Помощь">?</span>
            <span className={styles.avatar}>N</span>
          </div>
        </header>

        <aside className={styles.terminalRail} aria-label="Быстрая навигация">
          {RAIL_LINKS.map((item) => (
            <NavLink
              key={item.label}
              to={item.path}
              end={item.end}
              title={item.label}
              className={({ isActive }) => isActive ? `${styles.railLink} ${styles.railLinkActive}` : styles.railLink}
            >
              <RailIcon name={item.icon} />
            </NavLink>
          ))}
          <span className={styles.railCollapse}>»</span>
        </aside>

        <main className={styles.terminalContent}><Outlet /></main>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar} aria-label="Основная навигация">
        <div className={styles.brand}><span className={styles.brandMark}>N</span><span className={styles.brandText}>NEXUS</span></div>
        <nav className={styles.navigation}>{PRIMARY_NAVIGATION.map((item) => <NavLink key={item.path} to={item.path} end={item.end} className={getNavClassName} title={item.label}><span className={styles.navShortLabel}>{item.shortLabel}</span><span className={styles.navLabel}>{item.label}</span></NavLink>)}</nav>
        <div className={styles.environment}>TEST DATA</div>
      </aside>
      <div className={styles.mainColumn}>
        <header className={styles.topbar}><div><p className={styles.productLabel}>Аналитический терминал</p><p className={styles.dataStatus}>Источник данных: тестовый контур</p></div><div className={styles.connectionStatus}><span className={styles.connectionDot} />{pageVersion}</div></header>
        <main className={styles.content}><Outlet /></main>
      </div>
    </div>
  );
}
