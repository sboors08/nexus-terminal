import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ROUTES } from '@/app/routing/routes';
import {
  ALERT_EVENT_LABELS,
  ALERT_EVENT_MARKS,
  ALERT_SOURCE_LABELS,
  mapAlertTriggerToView,
  type AlertPriority,
  type AlertReadStatus,
  type RuntimeAlertViewItem,
} from '@/shared/alerts/alertsRuntimeView';
import {
  useApiQuery,
} from '@/shared/api';
import {
  createAlertRule,
  fetchAlertsRuntimeView,
  setAlertRuleEnabled,
  updateAlertRule,
  type AlertEventType,
  type AlertRule,
  type AlertsRuntimeView,
} from '@/shared/api/runtime/alertsRuntimeApi';
import { useFeedbackPageContext } from '@/shared/feedback/FeedbackProvider';
import { buildAlertsRealtimeView, useRealtimeMarketData } from '@/shared/realtime';
import { buildMarketWorkspaceUrl, buildWorkspaceUrl } from '@/shared/routing/setupContext';
import { AsyncDataState } from '@/shared/ui/AsyncDataState';
import { DirectionBadge, type TradeDirection } from '@/shared/ui/DirectionBadge';
import { SetupStageBadge } from '@/shared/ui/SetupStageBadge';
import styles from './AlertsPage.module.css';

type StatusFilter = 'all' | AlertReadStatus;
type TypeFilter = 'all' | AlertEventType;
type DirectionFilter = 'all' | TradeDirection;
type PriorityFilter = 'all' | AlertPriority;
type SortKey = 'latest' | 'priority';

const PRIORITY_ORDER: Record<AlertPriority, number> = { critical: 0, attention: 1, info: 2 };
const PRIORITY_LABELS: Record<AlertPriority, string> = {
  critical: 'Критичный',
  attention: 'Требует внимания',
  info: 'Информация',
};

function metricToneClass(tone: RuntimeAlertViewItem['metrics'][number]['tone']) {
  if (tone === 'positive') return styles.metricPositive;
  if (tone === 'negative') return styles.metricNegative;
  if (tone === 'warning') return styles.metricWarning;
  return '';
}

function getResultLabel(alert: RuntimeAlertViewItem) {
  return alert.eventType === 'setup_bounce' ? 'Отскок' as const : 'Пробой' as const;
}

function getWorkspaceUrl(alert: RuntimeAlertViewItem): string | null {
  if (!alert.symbol) return null;
  if (alert.setupId) {
    return buildWorkspaceUrl(ROUTES.workspace, {
      setupId: alert.setupId,
      symbol: alert.symbol,
      timeframe: alert.timeframe,
    });
  }
  return buildMarketWorkspaceUrl(ROUTES.workspace, alert.symbol, alert.timeframe);
}

function formatCooldown(cooldownMs: number): string {
  if (cooldownMs === 0) return 'без cooldown';
  if (cooldownMs % 3_600_000 === 0) return `${cooldownMs / 3_600_000} ч cooldown`;
  if (cooldownMs % 60_000 === 0) return `${cooldownMs / 60_000} мин cooldown`;
  return `${Math.round(cooldownMs / 1_000)} сек cooldown`;
}

function AlertsPageContent({
  data,
  refresh,
  refreshError,
}: {
  data: AlertsRuntimeView;
  refresh(): void;
  refreshError: Error | null;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewedTriggerIds, setViewedTriggerIds] = useState<Set<string>>(() => new Set());
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [eventType, setEventType] = useState<TypeFilter>('all');
  const [direction, setDirection] = useState<DirectionFilter>('all');
  const [priority, setPriority] = useState<PriorityFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('latest');
  const [operationKey, setOperationKey] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const defaultEventType = data.metadata.eventTypes.includes('volume_spike')
    ? 'volume_spike'
    : data.metadata.eventTypes[0] ?? 'custom_condition';
  const [ruleName, setRuleName] = useState('');
  const [ruleDescription, setRuleDescription] = useState('');
  const [ruleEventType, setRuleEventType] = useState<AlertEventType>(defaultEventType);
  const [ruleSymbol, setRuleSymbol] = useState('');
  const [ruleTimeframe, setRuleTimeframe] = useState('');
  const [ruleCooldownSeconds, setRuleCooldownSeconds] = useState('60');

  const alerts = useMemo(
    () => data.triggers.map((trigger) => mapAlertTriggerToView(trigger, viewedTriggerIds)),
    [data.triggers, viewedTriggerIds],
  );
  const realtimeSymbols = useMemo(
    () => [...new Set(alerts.flatMap((alert) => alert.symbol ? [alert.symbol] : []))].slice(0, 100),
    [alerts],
  );
  const realtime = useRealtimeMarketData({
    symbols: realtimeSymbols,
    enabled: realtimeSymbols.length > 0,
  });

  const filteredAlerts = useMemo(() => {
    const normalizedSearch = search.trim().toUpperCase();
    const result = alerts.filter((alert) => {
      if (normalizedSearch && !`${alert.displaySymbol} ${alert.title} ${alert.setupKind}`.toUpperCase().includes(normalizedSearch)) return false;
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

  const requestedAlertId = searchParams.get('alertId');
  const requestedSetupId = searchParams.get('setupId');
  const selectedAlert = useMemo(() => (
    filteredAlerts.find((alert) => alert.id === requestedAlertId)
      ?? alerts.find((alert) => alert.id === requestedAlertId)
      ?? filteredAlerts.find((alert) => alert.setupId !== null && alert.setupId === requestedSetupId)
      ?? alerts.find((alert) => alert.setupId !== null && alert.setupId === requestedSetupId)
      ?? filteredAlerts[0]
      ?? alerts[0]
      ?? null
  ), [alerts, filteredAlerts, requestedAlertId, requestedSetupId]);

  useEffect(() => {
    const currentAlertId = searchParams.get('alertId');
    const currentSetupId = searchParams.get('setupId');
    if (!selectedAlert) {
      if (!currentAlertId && !currentSetupId) return;
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('alertId');
      nextParams.delete('setupId');
      setSearchParams(nextParams, { replace: true });
      return;
    }
    if (currentAlertId === selectedAlert.id && currentSetupId === selectedAlert.setupId) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('alertId', selectedAlert.id);
    if (selectedAlert.setupId) nextParams.set('setupId', selectedAlert.setupId);
    else nextParams.delete('setupId');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, selectedAlert, setSearchParams]);

  useFeedbackPageContext({
    screen: 'Alerts',
    symbol: selectedAlert?.symbol ?? null,
    timeframe: selectedAlert?.timeframe ?? null,
    setupId: selectedAlert?.setupId ?? null,
  });

  const selectedRealtime = selectedAlert
    ? buildAlertsRealtimeView(
        selectedAlert.symbol ? realtime.snapshots[selectedAlert.symbol] : undefined,
        selectedAlert.price,
        realtime.lifecycleState,
        realtime.status?.state ?? null,
      )
    : null;
  const realtimeLiveCount = useMemo(
    () => realtimeSymbols.reduce((count, symbol) => {
      const snapshot = realtime.snapshots[symbol];
      return count + (snapshot?.lastTrade || snapshot?.bookTicker ? 1 : 0);
    }, 0),
    [realtime.snapshots, realtimeSymbols],
  );
  const newCount = alerts.filter((alert) => alert.readStatus === 'new').length;
  const criticalCount = alerts.filter((alert) => alert.priority === 'critical').length;

  const markAlertViewed = (id: string) => setViewedTriggerIds((current) => new Set(current).add(id));
  const markAllViewed = () => setViewedTriggerIds(new Set(alerts.map((alert) => alert.id)));
  const selectAlert = (alert: RuntimeAlertViewItem) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('alertId', alert.id);
    if (alert.setupId) nextParams.set('setupId', alert.setupId);
    else nextParams.delete('setupId');
    setSearchParams(nextParams);
  };
  const resetFilters = () => {
    setSearch('');
    setStatus('all');
    setEventType('all');
    setDirection('all');
    setPriority('all');
    setSortKey('latest');
  };

  const resetRuleForm = () => {
    setEditingRuleId(null);
    setRuleName('');
    setRuleDescription('');
    setRuleEventType(defaultEventType);
    setRuleSymbol('');
    setRuleTimeframe('');
    setRuleCooldownSeconds('60');
  };
  const beginEditRule = (rule: AlertRule) => {
    setEditingRuleId(rule.id);
    setRuleName(rule.name);
    setRuleDescription(rule.description ?? '');
    setRuleEventType(rule.eventType);
    setRuleSymbol(rule.symbol ?? '');
    setRuleTimeframe(rule.timeframe ?? '');
    setRuleCooldownSeconds(String(rule.cooldownMs / 1_000));
    setOperationError(null);
  };
  const saveRule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cooldownSeconds = Number(ruleCooldownSeconds);
    if (!Number.isFinite(cooldownSeconds) || cooldownSeconds < 0 || cooldownSeconds > 604_800) {
      setOperationError('Cooldown должен быть от 0 до 604800 секунд.');
      return;
    }
    setOperationKey(editingRuleId ? `edit:${editingRuleId}` : 'create');
    setOperationError(null);
    try {
      const input = {
        name: ruleName.trim(),
        description: ruleDescription.trim() || null,
        eventType: ruleEventType,
        symbol: ruleSymbol.trim().toUpperCase() || null,
        timeframe: ruleTimeframe.trim() || null,
        cooldownMs: Math.round(cooldownSeconds * 1_000),
      };
      if (editingRuleId) await updateAlertRule(editingRuleId, input);
      else await createAlertRule(input);
      resetRuleForm();
      refresh();
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'Не удалось сохранить правило.');
    } finally {
      setOperationKey(null);
    }
  };
  const toggleRule = async (rule: AlertRule) => {
    setOperationKey(`toggle:${rule.id}`);
    setOperationError(null);
    try {
      await setAlertRuleEnabled(rule.id, !rule.enabled);
      refresh();
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'Не удалось изменить правило.');
    } finally {
      setOperationKey(null);
    }
  };

  const persistenceHeadline = data.status.persistenceMode === 'persistent'
    ? data.status.persistenceState === 'ready'
      ? `PERSISTENT v${data.status.persistenceVersion ?? '?'}: правила и история сохраняются на backend`
      : `PERSISTENCE ${data.status.persistenceState.toUpperCase()}: backend работает с диагностируемым ограничением хранения`
    : 'RUNTIME ONLY: правила и история не сохраняются постоянно';
  const persistenceDescription = data.status.persistenceMode === 'persistent'
    ? `Storage: ${data.status.persistenceAdapter ?? 'unknown'}; восстановлено правил: ${data.status.hydratedRulesCount}, триггеров: ${data.status.hydratedTriggersCount}.`
    : 'Данные приходят из backend Alerts API и сбрасываются при перезапуске backend.';
  const deliveryDescription = data.status.deliveryState === 'disabled'
    ? 'Внешняя доставка не настроена: provider-neutral outbox готов, но активных каналов нет.'
    : `Delivery ${data.status.deliveryState}: каналов ${data.status.deliveryChannels.length}, в outbox ${data.status.deliveryOutboxCount}, ожидают ${data.status.deliveryPendingCount}, доставлено ${data.status.deliveryDeliveredCount}, ошибок ${data.status.deliveryFailedCount}.`;

  return (
    <section className={styles.alertsPage}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Backend Alerts runtime · live-цены Binance USDⓈ-M Futures</p>
          <h1 className={styles.title}>Alerts</h1>
          <p className={styles.subtitle}>Реальные события backend runtime, правила срабатывания и переходы в Workspace.</p>
        </div>
        <div className={styles.headerActions}>
          <div className={`${styles.runtimeStatus} ${styles[`runtimeStatus_${data.status.state}`]}`}><span className={styles.liveDot} aria-hidden="true" />Alerts runtime: {data.status.state}</div>
          {selectedRealtime && realtimeSymbols.length > 0 && <div className={`${styles.liveStatus} ${styles[`liveStatus_${selectedRealtime.connectionTone}`]}`}><span className={styles.liveDot} aria-hidden="true" />{selectedRealtime.connectionLabel} · {realtimeLiveCount}/{realtimeSymbols.length} монет</div>}
          {selectedRealtime?.connectionTone === 'error' && <button className={styles.secondaryButton} type="button" onClick={realtime.reconnect}>Повторить поток</button>}
          <button className={styles.secondaryButton} type="button" onClick={refresh}>Обновить Alerts</button>
          <button className={styles.secondaryButton} type="button" onClick={markAllViewed} disabled={newCount === 0}>Отметить всё просмотренным</button>
        </div>
      </header>

      {refreshError && <section className={styles.refreshWarning} role="status">Последнее обновление не удалось: {refreshError.message}. Показаны ранее загруженные данные.</section>}

      <section className={styles.summaryGrid} aria-label="Сводка Alerts">
        <article className={styles.summaryCard}><p>Новые в сессии</p><strong>{newCount}</strong><span>не открывались в этой вкладке</span></article>
        <article className={styles.summaryCard}><p>История триггеров</p><strong>{data.status.triggersCount}</strong><span>загружено: {alerts.length}</span></article>
        <article className={styles.summaryCard}><p>Включённые правила</p><strong>{data.status.enabledRulesCount}</strong><span>из {data.status.rulesCount} runtime-правил</span></article>
        <article className={`${styles.summaryCard} ${styles.summaryCritical}`}><p>Критичные события</p><strong>{criticalCount}</strong><span>в загруженной истории</span></article>
      </section>

      <section className={styles.dataNotice} aria-label="Граница хранения Alerts">
        <strong>{persistenceHeadline}</strong>
        <span>{persistenceDescription}</span>
        <span>{deliveryDescription} Отметка «просмотрено» действует только в этой вкладке.</span>
        {data.status.lastPersistenceError && <span>Ошибка persistence: {data.status.lastPersistenceError}</span>}
        {data.status.lastDeliveryErrorCode && <span>Delivery diagnostic: {data.status.lastDeliveryErrorCode}</span>}
      </section>

      <section className={styles.filtersPanel} aria-label="Фильтры уведомлений">
        <label className={styles.searchField}><span>Поиск</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Тикер, событие или источник" /></label>
        <div className={styles.statusFilter}><span className={styles.controlLabel}>Просмотр в сессии</span><div className={styles.segmentedControl}>{(['all', 'new', 'viewed'] as const).map((value) => <button key={value} type="button" className={status === value ? styles.segmentActive : ''} onClick={() => setStatus(value)}>{value === 'all' ? 'Все' : value === 'new' ? 'Новые' : 'Просмотренные'}</button>)}</div></div>
        <label className={styles.selectField}><span>Событие</span><select value={eventType} onChange={(event) => setEventType(event.target.value as TypeFilter)}><option value="all">Все типы событий</option>{data.metadata.eventTypes.map((value) => <option key={value} value={value}>{ALERT_EVENT_LABELS[value]}</option>)}</select></label>
        <label className={styles.selectField}><span>Направление</span><select value={direction} onChange={(event) => setDirection(event.target.value as DirectionFilter)}><option value="all">Любое / нет</option><option value="long">LONG</option><option value="short">SHORT</option></select></label>
        <label className={styles.selectField}><span>Важность</span><select value={priority} onChange={(event) => setPriority(event.target.value as PriorityFilter)}><option value="all">Любая</option><option value="critical">Критичные</option><option value="attention">Требуют внимания</option><option value="info">Информационные</option></select></label>
        <label className={styles.selectField}><span>Сортировка</span><select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}><option value="latest">Сначала новые</option><option value="priority">Сначала важные</option></select></label>
        <div className={styles.filterResult}><strong>{filteredAlerts.length}</strong><span>из {alerts.length}</span></div>
        <button className={styles.resetButton} type="button" onClick={resetFilters}>Сбросить</button>
      </section>

      <div className={styles.contentGrid}>
        <section className={styles.feedPanel} aria-label="Лента уведомлений">
          <div className={styles.panelHeader}><div><p className={styles.panelEyebrow}>Backend trigger history</p><h2>Уведомления</h2></div><span className={styles.testBadge}>LIVE API</span></div>
          <div className={styles.alertList}>
            {filteredAlerts.length > 0 ? filteredAlerts.map((alert) => {
              const workspaceUrl = getWorkspaceUrl(alert);
              const isSelected = selectedAlert?.id === alert.id;
              const isNew = alert.readStatus === 'new';
              return (
                <article key={alert.id} className={`${styles.alertCard} ${styles[`priority_${alert.priority}`]} ${isSelected ? styles.alertSelected : ''}`}>
                  <button className={styles.alertMain} type="button" onClick={() => { selectAlert(alert); markAlertViewed(alert.id); }} aria-pressed={isSelected}>
                    <span className={styles.eventMark} aria-hidden="true">{ALERT_EVENT_MARKS[alert.eventType]}</span>
                    <span className={styles.alertBody}>
                      <span className={styles.alertTopline}><span className={styles.instrumentLine}><strong>{alert.displaySymbol}</strong>{alert.direction && <DirectionBadge direction={alert.direction} />}{alert.timeframe && <span className={styles.timeframe}>{alert.timeframe}</span>}<span className={`${styles.priorityLabel} ${styles[`priorityText_${alert.priority}`]}`}>{PRIORITY_LABELS[alert.priority]}</span></span><span className={styles.alertTime}>{isNew && <span className={styles.unreadDot} aria-label="Новое уведомление" />}{alert.relativeTime}</span></span>
                      <span className={styles.alertTitle}>{alert.title}</span><span className={styles.alertExplanation}>{alert.explanation}</span>
                      <span className={styles.alertFooter}><span>{alert.eventLabel}</span><span>{alert.sourceLabel}</span><span>{alert.setupKind}</span></span>
                    </span>
                  </button>
                  {workspaceUrl && <Link className={styles.workspaceLink} to={workspaceUrl}>Открыть Workspace →</Link>}
                </article>
              );
            }) : <div className={styles.emptyState}><strong>{alerts.length === 0 ? 'Срабатываний пока нет' : 'Нет уведомлений по фильтрам'}</strong><span>{alerts.length === 0 ? 'Создайте или включите правило и дождитесь подходящего backend-события.' : 'Сбросьте фильтры или измените условия поиска.'}</span></div>}
          </div>
        </section>

        <aside className={styles.sideColumn}>
          <section className={styles.detailPanel} aria-label="Детали выбранного уведомления">
            {selectedAlert ? (() => {
              const workspaceUrl = getWorkspaceUrl(selectedAlert);
              return <>
                <div className={styles.detailHeader}><div><div className={styles.detailSymbolLine}><h2>{selectedAlert.displaySymbol}</h2>{selectedAlert.direction && <DirectionBadge direction={selectedAlert.direction} />}{selectedAlert.timeframe && <span className={styles.timeframe}>{selectedAlert.timeframe}</span>}</div><p>{selectedAlert.setupKind}</p></div>{selectedRealtime && <div className={styles.priceBlock}><span className={styles.priceLabel}>{selectedRealtime.isLive ? 'Текущая цена' : 'Цена события'}</span><strong>{selectedRealtime.currentPriceLabel}</strong>{selectedAlert.changePercent !== null && <span className={selectedAlert.changePercent >= 0 ? styles.positive : styles.negative}>{selectedAlert.changePercent > 0 ? '+' : ''}{selectedAlert.changePercent}% в событии</span>}<span className={styles.alertPriceReference}>Событие: {selectedRealtime.alertPriceLabel}</span><span className={styles.priceUpdatedAt}>{selectedRealtime.updatedAtLabel}</span></div>}</div>
                <div className={styles.detailMeta}><span className={`${styles.eventPill} ${styles[`priorityText_${selectedAlert.priority}`]}`}>{selectedAlert.eventLabel}</span>{selectedAlert.stage && <SetupStageBadge stage={selectedAlert.stage} resultLabel={getResultLabel(selectedAlert)} />}<span className={styles.timestamp}>{selectedAlert.timestamp}</span></div>
                <section className={styles.detailSection}><p className={styles.sectionLabel}>Что изменилось</p><h3>{selectedAlert.title}</h3><p>{selectedAlert.explanation}</p></section>
                <section className={`${styles.detailSection} ${styles.reasonSection}`}><p className={styles.sectionLabel}>Следующее действие</p><p>{selectedAlert.reasonToOpen}</p></section>
                {selectedAlert.metrics.length > 0 && <div className={styles.metricsGrid}>{selectedAlert.metrics.map((metric) => <div key={metric.label} className={styles.metricCard}><span>{metric.label}</span><strong className={metricToneClass(metric.tone)}>{metric.value}</strong></div>)}</div>}
                <div className={styles.detailActions}>{workspaceUrl && <Link className={styles.primaryButton} to={workspaceUrl}>Открыть Workspace →</Link>}<button className={styles.secondaryButton} type="button" onClick={() => markAlertViewed(selectedAlert.id)} disabled={selectedAlert.readStatus === 'viewed'}>{selectedAlert.readStatus === 'viewed' ? 'Просмотрено в сессии' : 'Отметить просмотренным'}</button></div>
              </>;
            })() : <div className={styles.emptyDetail}><strong>Выберите событие</strong><span>Детали появятся после первого срабатывания правила.</span></div>}
          </section>

          <section className={styles.rulesPanel} aria-label="Правила уведомлений">
            <div className={styles.panelHeader}><div><p className={styles.panelEyebrow}>Backend runtime rules</p><h2>Правила Alerts</h2></div><span className={styles.rulesCount}>{data.status.enabledRulesCount}/{data.rules.length}</span></div>
            <form className={styles.ruleForm} onSubmit={saveRule}>
              <div className={styles.ruleFormHeader}><strong>{editingRuleId ? 'Редактировать правило' : 'Новое правило'}</strong>{editingRuleId && <button type="button" onClick={resetRuleForm}>Отмена</button>}</div>
              <label><span>Название</span><input value={ruleName} onChange={(event) => setRuleName(event.target.value)} maxLength={120} required placeholder="Например, всплеск объёма SOL" /></label>
              <label><span>Описание</span><input value={ruleDescription} onChange={(event) => setRuleDescription(event.target.value)} maxLength={500} placeholder="Необязательно" /></label>
              <label><span>Тип события</span><select value={ruleEventType} onChange={(event) => setRuleEventType(event.target.value as AlertEventType)}>{data.metadata.eventTypes.map((value) => <option key={value} value={value}>{ALERT_EVENT_LABELS[value]}</option>)}</select></label>
              <div className={styles.ruleFormRow}><label><span>Символ</span><input value={ruleSymbol} onChange={(event) => setRuleSymbol(event.target.value)} placeholder="Все" /></label><label><span>Таймфрейм</span><input value={ruleTimeframe} onChange={(event) => setRuleTimeframe(event.target.value)} placeholder="Все" /></label><label><span>Cooldown, сек</span><input type="number" min="0" max="604800" step="1" value={ruleCooldownSeconds} onChange={(event) => setRuleCooldownSeconds(event.target.value)} required /></label></div>
              <button className={styles.primaryButton} type="submit" disabled={operationKey !== null}>{operationKey === 'create' || operationKey?.startsWith('edit:') ? 'Сохраняем…' : editingRuleId ? 'Сохранить изменения' : 'Создать правило'}</button>
            </form>
            {operationError && <p className={styles.operationError} role="alert">{operationError}</p>}
            <div className={styles.rulesList}>
              {data.rules.length > 0 ? data.rules.map((rule) => <div key={rule.id} className={styles.ruleItem}><div className={styles.ruleCopy}><strong>{rule.name}</strong><p>{rule.description ?? ALERT_EVENT_LABELS[rule.eventType]}</p><span>{ALERT_SOURCE_LABELS[rule.source]} · {rule.symbol ?? 'все символы'} · {rule.timeframe ?? 'все TF'} · {formatCooldown(rule.cooldownMs)} · rev {rule.revision}</span><button className={styles.editRuleButton} type="button" onClick={() => beginEditRule(rule)} disabled={operationKey !== null}>Изменить</button></div><button className={`${styles.toggle} ${rule.enabled ? styles.toggleActive : ''}`} type="button" role="switch" aria-checked={rule.enabled} aria-label={`${rule.enabled ? 'Отключить' : 'Включить'} правило «${rule.name}»`} onClick={() => void toggleRule(rule)} disabled={operationKey !== null}><span /></button></div>) : <div className={styles.rulesEmpty}>Правил пока нет. Создайте первое правило выше.</div>}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

export function AlertsPage() {
  const query = useApiQuery(
    'alerts-runtime-view',
    () => fetchAlertsRuntimeView({ limit: 500 }),
    { intervalMs: 5_000, preserveData: true },
  );
  if (query.status === 'loading' && !query.data) return <AsyncDataState state="loading" />;
  if (query.status === 'error' && !query.data) return <AsyncDataState state="error" message={query.error?.message ?? 'Alerts runtime недоступен'} onRetry={query.retry} />;
  if (!query.data) return <AsyncDataState state="empty" />;
  return <AlertsPageContent data={query.data} refresh={query.retry} refreshError={query.status === 'error' ? query.error : null} />;
}
