import { Link } from 'react-router';
import { ROUTES } from '@/app/routing/routes';
import styles from './NotFoundPage.module.css';

export function NotFoundPage() {
  return (
    <section className={styles.page}>
      <p className={styles.code}>404</p>
      <h1 className={styles.title}>Страница не найдена</h1>
      <p className={styles.description}>Проверьте адрес или вернитесь в основной раздел.</p>
      <Link className={styles.link} to={ROUTES.dashboard}>
        Вернуться в Dashboard
      </Link>
    </section>
  );
}
