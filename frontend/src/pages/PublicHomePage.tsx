import { Link, useParams } from 'react-router';
import { ROUTES } from '@/app/routing/routes';
import styles from './PublicHomePage.module.css';

const COPY_BY_LOCALE: Record<string, { title: string; description: string; action: string; status: string }> = {
  ru: {
    title: 'Публичная часть NEXUS',
    description: 'Маршрутизация подключена. Публичные страницы и SEO-контент будут добавлены отдельным этапом.',
    action: 'Открыть терминал',
    status: 'PUBLIC ROUTE READY',
  },
  en: {
    title: 'NEXUS public area',
    description: 'Routing is connected. Public pages and SEO content will be added in a separate stage.',
    action: 'Open terminal',
    status: 'PUBLIC ROUTE READY',
  },
  'zh-cn': {
    title: 'NEXUS 公共区域',
    description: '公共路由已连接。公开页面和 SEO 内容将在下一阶段添加。',
    action: '打开终端',
    status: 'PUBLIC ROUTE READY',
  },
};

export function PublicHomePage() {
  const { locale = 'ru' } = useParams();
  const copy = COPY_BY_LOCALE[locale.toLowerCase()] ?? COPY_BY_LOCALE.ru;

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <span className={styles.status}>{copy.status}</span>
        <div className={styles.brand}>NEXUS</div>
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>
        <Link className={styles.action} to={ROUTES.dashboard}>
          {copy.action}
        </Link>
      </section>
    </main>
  );
}
