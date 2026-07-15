import { NavLink, Outlet, useLocation } from 'react-router';
import { ROUTES } from '@/app/routing/routes';
import { PRIMARY_NAVIGATION } from '@/shared/config/navigation';
import styles from './AppShell.module.css';

function getNavClassName({ isActive }: { isActive: boolean }) {
  return isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink;
}

const PAGE_VERSION_LABELS: Record<string, string> = {
  [ROUTES.dashboard]: 'Dashboard v0.1',
  [ROUTES.scanner]: 'Scanner v0.1',
  [ROUTES.workspace]: 'Workspace v0.1',
  [ROUTES.alerts]: 'Alerts · каркас',
  [ROUTES.marketHistory]: 'Market History · каркас',
  [ROUTES.replay]: 'Replay · каркас',
  [ROUTES.settings]: 'Settings · каркас',
};

export function AppShell() {
  const location = useLocation();
  const pageVersion = PAGE_VERSION_LABELS[location.pathname] ?? 'NEXUS frontend';

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar} aria-label="Основная навигация">
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            N
          </span>
          <span className={styles.brandText}>NEXUS</span>
        </div>

        <nav className={styles.navigation}>
          {PRIMARY_NAVIGATION.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={getNavClassName}
              title={item.label}
            >
              <span className={styles.navShortLabel} aria-hidden="true">
                {item.shortLabel}
              </span>
              <span className={styles.navLabel}>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className={styles.environment}>TEST DATA</div>
      </aside>

      <div className={styles.mainColumn}>
        <header className={styles.topbar}>
          <div>
            <p className={styles.productLabel}>Аналитический терминал</p>
            <p className={styles.dataStatus}>Источник данных: тестовый контур</p>
          </div>
          <div className={styles.connectionStatus}>
            <span className={styles.connectionDot} aria-hidden="true" />
            {pageVersion}
          </div>
        </header>

        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
