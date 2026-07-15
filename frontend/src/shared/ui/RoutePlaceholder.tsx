import type { ReactNode } from 'react';
import styles from './RoutePlaceholder.module.css';

type RoutePlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
};

export function RoutePlaceholder({
  eyebrow,
  title,
  description,
  children,
}: RoutePlaceholderProps) {
  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>
      </header>

      <div className={styles.placeholder}>
        <span className={styles.status}>Маршрут подключён</span>
        <p className={styles.placeholderText}>
          Функциональные блоки этого экрана будут добавлены отдельной задачей.
        </p>
        {children}
      </div>
    </section>
  );
}
