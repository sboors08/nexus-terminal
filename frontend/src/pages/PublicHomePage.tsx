import { Link } from 'react-router';
import { ROUTES } from '@/app/routing/routes';
import { useI18n } from '@/shared/i18n/I18nProvider';
import styles from './PublicHomePage.module.css';

export function PublicHomePage() {
  const { dictionary } = useI18n();
  const copy = dictionary.publicHome;

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <span className={styles.status}>{copy.status}</span>
        <div className={styles.brand}>{copy.brand}</div>
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>
        <Link className={styles.action} to={ROUTES.dashboard}>
          {copy.action}
        </Link>
      </section>
    </main>
  );
}
