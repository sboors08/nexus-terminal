import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ROUTES } from '@/app/routing/routes';
import {
  ALERT_EVENT_LABELS,
  ALERTS,
  INITIAL_ALERT_RULES,
  type AlertEventType,
  type AlertPriority,
  type AlertReadStatus,
  type NexusAlert,
} from '@/features/alerts/alertsData';
import { DirectionBadge, type TradeDirection } from '@/shared/ui/DirectionBadge';
import { SetupStageBadge } from '@/shared/ui/SetupStageBadge';
import styles from './AlertsPage.module.css';

type StatusFilter = 'all' | AlertReadStatus;
type TypeFilter = 'all' | AlertEventType;
type DirectionFilter = 'all' | TradeDirection;
type PriorityFilter = 'all' | AlertPriority;
type SortKey = 'latest' | 'priority';

const PRIORITY_ORDER: Record<AlertPriority, number> = {
  critical: 0,
  attention: 1,
  info: 2,
};

const PRIORITY_LABELS: Record<AlertPriority, string> = {
  critical: 'Критичный',
  attention: 'Требует внимания',
  info: 'Информация',
};

const EVENT_MARKS: Record<AlertEventType, string> = {
  'price-near-level': '≈',
  confirmation: 'C',
  'prints-flow': 'P',
  'liquidity-increased': '+',
  'liquidity-weakened': '−',
  'liquidity-removed': '×',
  'level-broken': 'B',
  bounce: '↗',
  invalidated: '!',
};

function getResultLabel(alert: NexusAlert) {
  return alert.setupKind.startsWith('Отскок') ? 'Отскок' : 'Пробой';
}

function metricToneClass(tone: NexusAlert['metrics'][number]['tone']) {
  if (tone === 'positive') return styles.metricPositive;
  if (tone === 'negative') return styles.metricNegative;
  if (tone === 'warning') return styles.metricWarning;
  return '';
}

export function AlertsPage() {
  const [alerts, setAlerts] = useState(ALERTS);
  const [rules, setRules] = useState(INITIAL_ALERT_RULES);
  const [selectedId, setSelectedId] = useState(ALERTS[0].id);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [eventType, setEventType] = useState<TypeFilter>('all');
  const [direction, setDirection] = useState<DirectionFilter>('all');
  const [priority, setPriority] = useState<PriorityFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('latest');

  const filteredAlerts = useMemo(() => {
    const normalizedSearch = search.trim().toUpperCase();
    const result = alerts.filter((alert) => {
      if (normalizedSearch && !`${alert.symbol} ${alert.title} ${alert.setupKind}`.toUpperCase().includes(normalizedSearch)) return false;
      if (status !== 'all' && alert.readStatus !== status) return false;
      if (eventType !== 'all' && alert.eventType !== eventType) return false;
      if (direction !== 'all' && alert.direction !== direction) return false;
      if (priority !== 'all' && alert.priority !== priority) return false;
      return true;
    });

    if (sortKey === 'priority') {
      return [...result].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
    }

    return result;
  }, [alerts, direction, eventType, priority, search, sortKey, status]);

  const selectedAlert = useMemo(() => (
    filteredAlerts.find((alert) => alert.id === selectedId)
      ?? alerts.find((alert) => alert.id === selectedId)
      ?? filteredAlerts[0]
      ?? alerts[0]
  ), [alerts, filteredAlerts, selectedId]);

  const newCount = alerts.filter((alert) => alert.readStatus === 'new').length;
  const criticalCount = alerts.filter((alert) => alert.priority === 'critical').length;
  const enabledRulesCount = rules.filter((rule) => rule.enabled).length;

  const markAlertViewed = (id: string) => {
    setAlerts((current) => current.map((alert) => (
      alert.id === id ? { ...alert, readStatus: 'viewed' } : alert
    )));
  };

  const markAllViewed = () => {
    setAlerts((current) => current.map((alert) => ({ ...alert, readStatus: 'viewed' })));
  };

  const resetFilters = () => {
    setSearch('');
    setStatus('all');
    setEventType('all');
    setDirection('all');
    setPriority('all');
    setSortKey('latest');
  };

  const toggleRule = (ruleId: string) => {
    setRules((current) => current.map((rule) => (
      rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
    )));
  };

  return (
    <section className={styles.alertsPage}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Контроль сетапов · тестовые данные</p>
          <h1 className={styles.title}>Alerts</h1>
          <p className={styles.subtitle}>Изменения, которые требуют внимания, с объяснением причины и контекста.</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.liveStatus}>
            <span className={styles.liveDot} aria-hidden="true" />
            LIVE TEST · 17:32:26
          </div>
          <button className={styles.secondaryButton} type="button" onClick={markAllViewed} disabled={newCount === 0}>
            Отметить всё прочитанным
          </button>
        </div>
      </header>

      <section className={styles.summaryGrid} aria-label="Сводка уведомлений">
        <article className={styles.summaryCard}>
          <p>Новые</p>
          <strong>{newCount}</strong>
          <span>ещё не просмотрены</span>
        </article>
        <article className={styles.summaryCard}>
          <p>Сработали сегодня</p>
          <strong>{alerts.length}</strong>
          <span>по активным сетапам</span>
        </article>
        <article className={styles.summaryCard}>
          <p>Активные правила</p>
          <strong>{enabledRulesCount}</strong>
          <span>из {rules.length} настроенных</span>
        </article>
        <article className={`${styles.summaryCard} ${styles.summaryCritical}`}>
          <p>Критичные события</p>
          <strong>{criticalCount}</strong>
          <span>подтверждение или реализация</span>
        </article>
      </section>

      <section className={styles.filtersPanel} aria-label="Фильтры уведомлений">
        <label className={styles.searchField}>
          <span>Поиск</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Тикер, событие или тип сетапа"
          />
        </label>

        <div className={styles.statusFilter}>
          <span className={styles.controlLabel}>Статус</span>
          <div className={styles.segmentedControl}>
            {(['all', 'new', 'viewed'] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={status === value ? styles.segmentActive : ''}
                onClick={() => setStatus(value)}
              >
                {value === 'all' ? 'Все' : value === 'new' ? 'Новые' : 'Просмотренные'}
              </button>
            ))}
          </div>
        </div>

        <label className={styles.selectField}>
          <span>Событие</span>
          <select value={eventType} onChange={(event) => setEventType(event.target.value as TypeFilter)}>
            <option value="all">Все типы событий</option>
            {(Object.entries(ALERT_EVENT_LABELS) as Array<[AlertEventType, string]>).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        <label className={styles.selectField}>
          <span>Направление</span>
          <select value={direction} onChange={(event) => setDirection(event.target.value as DirectionFilter)}>
            <option value="all">LONG и SHORT</option>
            <option value="long">LONG</option>
            <option value="short">SHORT</option>
          </select>
        </label>

        <label className={styles.selectField}>
          <span>Важность</span>
          <select value={priority} onChange={(event) => setPriority(event.target.value as PriorityFilter)}>
            <option value="all">Любая</option>
            <option value="critical">Критичные</option>
            <option value="attention">Требуют внимания</option>
            <option value="info">Информационные</option>
          </select>
        </label>

        <label className={styles.selectField}>
          <span>Сортировка</span>
          <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
            <option value="latest">Сначала новые</option>
            <option value="priority">Сначала важные</option>
          </select>
        </label>

        <div className={styles.filterResult}>
          <strong>{filteredAlerts.length}</strong>
          <span>из {alerts.length}</span>
        </div>

        <button className={styles.resetButton} type="button" onClick={resetFilters}>Сбросить</button>
      </section>

      <div className={styles.contentGrid}>
        <section className={styles.feedPanel} aria-label="Лента уведомлений">
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelEyebrow}>Лента событий</p>
              <h2>Уведомления</h2>
            </div>
            <span className={styles.testBadge}>TEST DATA</span>
          </div>

          <div className={styles.alertList}>
            {filteredAlerts.length > 0 ? filteredAlerts.map((alert) => {
              const isSelected = selectedAlert.id === alert.id;
              const isNew = alert.readStatus === 'new';
              return (
                <article
                  key={alert.id}
                  className={`${styles.alertCard} ${styles[`priority_${alert.priority}`]} ${isSelected ? styles.alertSelected : ''}`}
                >
                  <button
                    className={styles.alertMain}
                    type="button"
                    onClick={() => {
                      setSelectedId(alert.id);
                      markAlertViewed(alert.id);
                    }}
                    aria-pressed={isSelected}
                  >
                    <span className={styles.eventMark} aria-hidden="true">{EVENT_MARKS[alert.eventType]}</span>
                    <span className={styles.alertBody}>
                      <span className={styles.alertTopline}>
                        <span className={styles.instrumentLine}>
                          <strong>{alert.symbol}</strong>
                          <DirectionBadge direction={alert.direction} />
                          <span className={styles.timeframe}>{alert.timeframe}</span>
                          <span className={`${styles.priorityLabel} ${styles[`priorityText_${alert.priority}`]}`}>
                            {PRIORITY_LABELS[alert.priority]}
                          </span>
                        </span>
                        <span className={styles.alertTime}>
                          {isNew && <span className={styles.unreadDot} aria-label="Новое уведомление" />}
                          {alert.relativeTime}
                        </span>
                      </span>
                      <span className={styles.alertTitle}>{alert.title}</span>
                      <span className={styles.alertExplanation}>{alert.explanation}</span>
                      <span className={styles.alertFooter}>
                        <span>{alert.eventLabel}</span>
                        <span>{alert.setupKind}</span>
                        <span>Почему открыть: {alert.reasonToOpen}</span>
                      </span>
                    </span>
                  </button>
                  <Link className={styles.workspaceLink} to={`${ROUTES.workspace}?symbol=${alert.symbol}`}>
                    Открыть Workspace →
                  </Link>
                </article>
              );
            }) : (
              <div className={styles.emptyState}>
                <strong>Нет уведомлений по выбранным фильтрам</strong>
                <span>Сбросьте фильтры или измените условия поиска.</span>
              </div>
            )}
          </div>
        </section>

        <aside className={styles.sideColumn}>
          <section className={styles.detailPanel} aria-label="Детали выбранного уведомления">
            <div className={styles.detailHeader}>
              <div>
                <div className={styles.detailSymbolLine}>
                  <h2>{selectedAlert.symbol}</h2>
                  <DirectionBadge direction={selectedAlert.direction} />
                  <span className={styles.timeframe}>{selectedAlert.timeframe}</span>
                </div>
                <p>{selectedAlert.setupKind}</p>
              </div>
              <div className={styles.priceBlock}>
                <strong>{selectedAlert.price}</strong>
                <span className={selectedAlert.changePercent >= 0 ? styles.positive : styles.negative}>
                  {selectedAlert.changePercent >= 0 ? '+' : ''}{selectedAlert.changePercent}%
                </span>
              </div>
            </div>

            <div className={styles.detailMeta}>
              <span className={`${styles.eventPill} ${styles[`priorityText_${selectedAlert.priority}`]}`}>
                {selectedAlert.eventLabel}
              </span>
              <SetupStageBadge stage={selectedAlert.stage} resultLabel={getResultLabel(selectedAlert)} />
              <span className={styles.timestamp}>{selectedAlert.timestamp}</span>
            </div>

            <section className={styles.detailSection}>
              <p className={styles.sectionLabel}>Что изменилось</p>
              <h3>{selectedAlert.title}</h3>
              <p>{selectedAlert.explanation}</p>
            </section>

            <section className={`${styles.detailSection} ${styles.reasonSection}`}>
              <p className={styles.sectionLabel}>Почему стоит открыть Workspace</p>
              <p>{selectedAlert.reasonToOpen}</p>
            </section>

            <div className={styles.metricsGrid}>
              {selectedAlert.metrics.map((metric) => (
                <div key={metric.label} className={styles.metricCard}>
                  <span>{metric.label}</span>
                  <strong className={metricToneClass(metric.tone)}>{metric.value}</strong>
                </div>
              ))}
            </div>

            <div className={styles.detailActions}>
              <Link className={styles.primaryButton} to={`${ROUTES.workspace}?symbol=${selectedAlert.symbol}`}>
                Открыть Workspace →
              </Link>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() => markAlertViewed(selectedAlert.id)}
                disabled={selectedAlert.readStatus === 'viewed'}
              >
                {selectedAlert.readStatus === 'viewed' ? 'Просмотрено' : 'Отметить прочитанным'}
              </button>
            </div>
          </section>

          <section className={styles.rulesPanel} aria-label="Активные правила уведомлений">
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelEyebrow}>Логика уведомлений</p>
                <h2>Активные правила</h2>
              </div>
              <span className={styles.rulesCount}>{enabledRulesCount}/{rules.length}</span>
            </div>

            <div className={styles.rulesList}>
              {rules.map((rule) => (
                <div key={rule.id} className={styles.ruleItem}>
                  <div className={styles.ruleCopy}>
                    <strong>{rule.title}</strong>
                    <p>{rule.description}</p>
                    <span>{rule.scope} · сегодня {rule.matchesToday}</span>
                  </div>
                  <button
                    className={`${styles.toggle} ${rule.enabled ? styles.toggleActive : ''}`}
                    type="button"
                    role="switch"
                    aria-checked={rule.enabled}
                    aria-label={`${rule.enabled ? 'Отключить' : 'Включить'} правило «${rule.title}»`}
                    onClick={() => toggleRule(rule.id)}
                  >
                    <span />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
