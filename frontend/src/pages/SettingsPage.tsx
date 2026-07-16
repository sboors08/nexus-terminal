import { useMemo, useState, type ChangeEvent, type CSSProperties } from 'react';
import {
  cloneSettings,
  DEFAULT_SETTINGS,
  SETTINGS_GROUPS,
  SETTINGS_PRESETS,
  type ExternalTerminal,
  type NexusSettings,
  type PrimaryTimeframe,
  type PullbackDepth,
  type SettingsGroupId,
  type SettingsPresetId,
} from '@/features/settings/settingsData';
import styles from './SettingsPage.module.css';

const STORAGE_KEY = 'nexus.settings.v0.1';
const PRESET_KEY = 'nexus.settings.preset.v0.1';

function readStoredSettings(): NexusSettings {
  if (typeof window === 'undefined') {
    return cloneSettings(DEFAULT_SETTINGS);
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneSettings(DEFAULT_SETTINGS);
    const parsed = JSON.parse(raw) as Partial<NexusSettings>;

    return {
      ...cloneSettings(DEFAULT_SETTINGS),
      ...parsed,
      additionalTimeframes: Array.isArray(parsed.additionalTimeframes)
        ? parsed.additionalTimeframes
        : [...DEFAULT_SETTINGS.additionalTimeframes],
    };
  } catch {
    return cloneSettings(DEFAULT_SETTINGS);
  }
}

function readStoredPreset(): SettingsPresetId {
  if (typeof window === 'undefined') return 'intraday';
  const stored = window.localStorage.getItem(PRESET_KEY);
  return stored === 'scalping' || stored === 'intraday' || stored === 'swing' || stored === 'custom'
    ? stored
    : 'intraday';
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <label className={styles.toggleRow}>
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.checked)}
      />
      <i aria-hidden="true" />
    </label>
  );
}

function RangeField({
  label,
  description,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  const progress = ((value - min) / (max - min)) * 100;

  return (
    <label className={styles.rangeField}>
      <span className={styles.fieldHeading}>
        <span>
          <strong>{label}</strong>
          <small>{description}</small>
        </span>
        <output>{value}{suffix}</output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--range-progress': `${progress}%` } as CSSProperties}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(Number(event.target.value))}
      />
      <span className={styles.rangeLimits}>
        <small>{min}{suffix}</small>
        <small>{max}{suffix}</small>
      </span>
    </label>
  );
}

export function SettingsPage() {
  const [activeGroup, setActiveGroup] = useState<SettingsGroupId>('general');
  const [activePreset, setActivePreset] = useState<SettingsPresetId>(readStoredPreset);
  const [settings, setSettings] = useState<NexusSettings>(readStoredSettings);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const activeGroupMeta = useMemo(
    () => SETTINGS_GROUPS.find((group) => group.id === activeGroup) ?? SETTINGS_GROUPS[0],
    [activeGroup],
  );

  const updateSettings = (patch: Partial<NexusSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
    setActivePreset('custom');
    setSavedAt(null);
  };

  const applyPreset = (presetId: Exclude<SettingsPresetId, 'custom'>) => {
    const preset = SETTINGS_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;

    setSettings(cloneSettings(preset.settings));
    setActivePreset(presetId);
    setSavedAt(null);
  };

  const toggleAdditionalTimeframe = (timeframe: PrimaryTimeframe) => {
    const exists = settings.additionalTimeframes.includes(timeframe);
    updateSettings({
      additionalTimeframes: exists
        ? settings.additionalTimeframes.filter((item) => item !== timeframe)
        : [...settings.additionalTimeframes, timeframe],
    });
  };

  const saveSettings = () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.localStorage.setItem(PRESET_KEY, activePreset);
    setSavedAt(new Date().toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }));
  };

  const resetSettings = () => {
    const fallbackPreset = activePreset === 'custom'
      ? SETTINGS_PRESETS.find((item) => item.id === 'intraday')
      : SETTINGS_PRESETS.find((item) => item.id === activePreset);

    setSettings(cloneSettings(fallbackPreset?.settings ?? DEFAULT_SETTINGS));
    setActivePreset(fallbackPreset?.id ?? 'intraday');
    setSavedAt(null);
  };

  const renderGroup = () => {
    if (activeGroup === 'general') {
      return (
        <>
          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Рабочий период</p>
                <h2>Таймфреймы</h2>
                <span>При смене основного периода NEXUS будет пересчитывать активность и параметры сетапов.</span>
              </div>
            </div>

            <div className={styles.fieldGrid}>
              <label className={styles.selectField}>
                <span>
                  <strong>Основной таймфрейм</strong>
                  <small>Используется как базовый период Scanner и Workspace.</small>
                </span>
                <select
                  value={settings.primaryTimeframe}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) => updateSettings({
                    primaryTimeframe: event.target.value as PrimaryTimeframe,
                    additionalTimeframes: settings.additionalTimeframes.filter(
                      (item) => item !== event.target.value,
                    ),
                  })}
                >
                  <option value="1m">1 минута</option>
                  <option value="5m">5 минут</option>
                  <option value="15m">15 минут</option>
                  <option value="1h">1 час</option>
                </select>
              </label>

              <div className={styles.choiceField}>
                <span>
                  <strong>Дополнительные таймфреймы</strong>
                  <small>Используются для подтверждения уровня и рыночного контекста.</small>
                </span>
                <div className={styles.choiceButtons}>
                  {(['1m', '5m', '15m', '1h'] as const).map((timeframe) => (
                    <button
                      key={timeframe}
                      type="button"
                      className={settings.additionalTimeframes.includes(timeframe)
                        ? styles.choiceButtonActive
                        : ''}
                      disabled={timeframe === settings.primaryTimeframe}
                      onClick={() => toggleAdditionalTimeframe(timeframe)}
                    >
                      {timeframe}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Поведение интерфейса</p>
                <h2>Рабочий процесс</h2>
              </div>
            </div>
            <Toggle
              checked={settings.autoOpenWorkspace}
              onChange={(checked) => updateSettings({ autoOpenWorkspace: checked })}
              label="Автоматически открывать Workspace"
              description="После выбора сетапа в Scanner сразу переходить в рабочее пространство."
            />
          </section>
        </>
      );
    }

    if (activeGroup === 'setups') {
      return (
        <>
          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Стратегии v1</p>
                <h2>Типы сетапов</h2>
                <span>Новые стратегии будут добавляться отдельно и не изменят текущую структуру настроек.</span>
              </div>
            </div>
            <Toggle
              checked={settings.breakoutEnabled}
              onChange={(checked) => updateSettings({ breakoutEnabled: checked })}
              label="Пробой уровня"
              description="Пробой сопротивления для LONG и пробой поддержки для SHORT."
            />
            <Toggle
              checked={settings.bounceEnabled}
              onChange={(checked) => updateSettings({ bounceEnabled: checked })}
              label="Отскок от уровня"
              description="Реакция от поддержки для LONG и от сопротивления для SHORT."
            />
          </section>

          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Направление</p>
                <h2>Стороны рынка</h2>
              </div>
            </div>
            <Toggle
              checked={settings.longEnabled}
              onChange={(checked) => updateSettings({ longEnabled: checked })}
              label="Искать LONG"
              description="Показывать сетапы на рост и реакцию покупателей."
            />
            <Toggle
              checked={settings.shortEnabled}
              onChange={(checked) => updateSettings({ shortEnabled: checked })}
              label="Искать SHORT"
              description="Показывать сетапы на снижение и реакцию продавцов."
            />
          </section>
        </>
      );
    }

    if (activeGroup === 'levels') {
      return (
        <>
          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Ценовая зона</p>
                <h2>Параметры уровня</h2>
                <span>Уровень всегда рассматривается как зона, а не как точная линия.</span>
              </div>
            </div>
            <RangeField
              label="Допуск уровня"
              description="Ширина зоны вокруг группы локальных максимумов или минимумов."
              value={settings.levelTolerancePct}
              min={0.1}
              max={1}
              step={0.1}
              suffix="%"
              onChange={(value) => updateSettings({ levelTolerancePct: value })}
            />
            <RangeField
              label="Минимум касаний"
              description="Сколько подтверждённых реакций требуется для формирования уровня."
              value={settings.minTouches}
              min={2}
              max={6}
              step={1}
              suffix=""
              onChange={(value) => updateSettings({ minTouches: value })}
            />
            <RangeField
              label="Время формирования"
              description="Минимальная продолжительность существования уровня."
              value={settings.formationMinutes}
              min={15}
              max={720}
              step={15}
              suffix=" мин"
              onChange={(value) => updateSettings({ formationMinutes: value })}
            />
          </section>

          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Структура подхода</p>
                <h2>Глубина откатов</h2>
              </div>
            </div>
            <div className={styles.segmentedControl}>
              {([
                ['any', 'Любые', 'Не ограничивать Scanner по глубине откатов.'],
                ['shallow', 'Неглубокие', 'Приоритет уровням с поджатием цены.'],
                ['deep', 'Глубокие', 'Приоритет более широким реакциям от зоны.'],
              ] as const).map(([value, label, description]) => (
                <button
                  key={value}
                  type="button"
                  className={settings.pullbackDepth === value ? styles.segmentActive : ''}
                  onClick={() => updateSettings({ pullbackDepth: value as PullbackDepth })}
                >
                  <strong>{label}</strong>
                  <span>{description}</span>
                </button>
              ))}
            </div>
          </section>
        </>
      );
    }

    if (activeGroup === 'indicators') {
      return (
        <>
          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Фильтрация</p>
                <h2>Сила и активность</h2>
              </div>
            </div>
            <RangeField
              label="Минимальная сила уровня"
              description="Комплексная оценка качества зоны до появления Setup Score."
              value={settings.minLevelStrength}
              min={30}
              max={100}
              step={5}
              suffix="/100"
              onChange={(value) => updateSettings({ minLevelStrength: value })}
            />
            <RangeField
              label="Минимальная активность"
              description="Отношение текущей активности к базовому значению."
              value={settings.minActivity}
              min={0.5}
              max={3}
              step={0.1}
              suffix="×"
              onChange={(value) => updateSettings({ minActivity: value })}
            />
          </section>

          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Подтверждения</p>
                <h2>Контекст сетапа</h2>
              </div>
            </div>
            <Toggle
              checked={settings.useVolumeAnomaly}
              onChange={(checked) => updateSettings({ useVolumeAnomaly: checked })}
              label="Аномалия объёма"
              description="Сравнивать текущий объём с базовым значением выбранного периода."
            />
            <Toggle
              checked={settings.useTradesAnomaly}
              onChange={(checked) => updateSettings({ useTradesAnomaly: checked })}
              label="Аномалия количества сделок"
              description="Учитывать рост числа сделок и скорости торгового потока."
            />
            <Toggle
              checked={settings.useBtcContext}
              onChange={(checked) => updateSettings({ useBtcContext: checked })}
              label="BTC-контекст"
              description="Учитывать корреляцию и силу инструмента относительно BTC."
            />
          </section>
        </>
      );
    }

    if (activeGroup === 'notifications') {
      return (
        <>
          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionEyebrow}>События сетапа</p>
                <h2>Когда уведомлять</h2>
                <span>Каждый алерт должен объяснять, что изменилось и почему стоит открыть Workspace.</span>
              </div>
            </div>
            <Toggle
              checked={settings.notifyNearLevel}
              onChange={(checked) => updateSettings({ notifyNearLevel: checked })}
              label="Цена подошла к уровню"
              description="Расстояние до зоны достигло рабочего значения."
            />
            <Toggle
              checked={settings.notifyConfirmation}
              onChange={(checked) => updateSettings({ notifyConfirmation: checked })}
              label="Переход в подтверждение"
              description="Сетап выполнил основные условия перед реализацией."
            />
            <Toggle
              checked={settings.notifyPrints}
              onChange={(checked) => updateSettings({ notifyPrints: checked })}
              label="Активировался поток принтов"
              description="Скорость и направление агрессивных сделок изменились."
            />
            <Toggle
              checked={settings.notifyLiquidity}
              onChange={(checked) => updateSettings({ notifyLiquidity: checked })}
              label="Изменение ликвидности"
              description="Значимая плотность увеличилась, ослабла или была снята."
            />
            <Toggle
              checked={settings.notifyTriggered}
              onChange={(checked) => updateSettings({ notifyTriggered: checked })}
              label="Пробой или отскок"
              description="Цена реализовала ожидаемый сценарий возле уровня."
            />
            <Toggle
              checked={settings.notifyInvalidated}
              onChange={(checked) => updateSettings({ notifyInvalidated: checked })}
              label="Сетап потерял актуальность"
              description="Условия поиска больше не соответствуют текущему рынку."
            />
          </section>

          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Звук</p>
                <h2>Сигнал уведомления</h2>
              </div>
            </div>
            <Toggle
              checked={settings.soundEnabled}
              onChange={(checked) => updateSettings({ soundEnabled: checked })}
              label="Звуковые уведомления"
              description="В тестовой версии настройка сохраняется локально без воспроизведения звука."
            />
          </section>
        </>
      );
    }

    if (activeGroup === 'integrations') {
      return (
        <>
          <section className={styles.sectionCard}>
            <div className={styles.integrationHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Источник данных</p>
                <h2>Binance</h2>
                <span>Подключение реальных потоков будет выполнено отдельным этапом.</span>
              </div>
              <span className={styles.testStatus}>TEST DATA</span>
            </div>
            <div className={styles.integrationInfo}>
              <div><span>Режим</span><strong>Тестовый контур</strong></div>
              <div><span>Потоки</span><strong>Не подключены</strong></div>
              <div><span>API-ключ</span><strong>Не требуется</strong></div>
            </div>
          </section>

          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Внешняя торговля</p>
                <h2>Терминал для исполнения</h2>
                <span>NEXUS не выставляет ордера и используется только как аналитический экран.</span>
              </div>
            </div>
            <label className={styles.selectField}>
              <span>
                <strong>Внешний терминал</strong>
                <small>Выбор подготовлен для будущей кнопки открытия инструмента.</small>
              </span>
              <select
                value={settings.externalTerminal}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => updateSettings({
                  externalTerminal: event.target.value as ExternalTerminal,
                })}
              >
                <option value="none">Не выбран</option>
                <option value="tiger">Tiger</option>
                <option value="cscalp">CScalp</option>
                <option value="atas">ATAS</option>
              </select>
            </label>
          </section>
        </>
      );
    }

    return (
      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionEyebrow}>Интерфейс</p>
            <h2>Отображение терминала</h2>
            <span>Тёмная тема и базовая дизайн-система NEXUS остаются неизменными.</span>
          </div>
        </div>
        <Toggle
          checked={settings.compactMode}
          onChange={(checked) => updateSettings({ compactMode: checked })}
          label="Компактный режим"
          description="Уменьшить вертикальные отступы таблиц и рабочих панелей."
        />
        <Toggle
          checked={settings.showTooltips}
          onChange={(checked) => updateSettings({ showTooltips: checked })}
          label="Интерактивные подсказки"
          description="Показывать объяснения параметров Scanner и Workspace."
        />
        <Toggle
          checked={settings.reduceMotion}
          onChange={(checked) => updateSettings({ reduceMotion: checked })}
          label="Уменьшить анимацию"
          description="Сократить декоративные переходы и движение интерфейса."
        />
      </section>
    );
  };

  return (
    <section className={styles.settingsPage}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Конфигурация терминала · локальное сохранение</p>
          <h1>Settings</h1>
          <p>Настройка логики поиска сетапов, уровней, индикаторов и уведомлений.</p>
        </div>
        <div className={styles.headerStatus}>
          <span className={activePreset === 'custom' ? styles.customStatus : styles.presetStatus}>
            {activePreset === 'custom'
              ? 'Пользовательские настройки'
              : `Пресет: ${SETTINGS_PRESETS.find((item) => item.id === activePreset)?.name}`}
          </span>
          {savedAt && <small>Сохранено локально в {savedAt}</small>}
        </div>
      </header>

      <section className={styles.presetSection} aria-label="Пресеты настроек">
        <div className={styles.presetHeading}>
          <div>
            <p className={styles.sectionEyebrow}>Быстрый старт</p>
            <h2>Пресеты</h2>
          </div>
          <span>Изменение любого параметра создаёт пользовательскую конфигурацию.</span>
        </div>

        <div className={styles.presetGrid}>
          {SETTINGS_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={activePreset === preset.id ? styles.presetCardActive : styles.presetCard}
              onClick={() => applyPreset(preset.id)}
            >
              <span className={styles.presetCardTop}>
                <strong>{preset.name}</strong>
                <small>{preset.badge}</small>
              </span>
              <span>{preset.description}</span>
              <span className={styles.presetMeta}>
                {preset.settings.primaryTimeframe} · {preset.settings.minTouches} касания · {preset.settings.levelTolerancePct}%
              </span>
            </button>
          ))}
        </div>
      </section>

      <div className={styles.settingsLayout}>
        <nav className={styles.settingsNavigation} aria-label="Группы настроек">
          {SETTINGS_GROUPS.map((group) => (
            <button
              key={group.id}
              type="button"
              className={activeGroup === group.id ? styles.groupButtonActive : styles.groupButton}
              onClick={() => setActiveGroup(group.id)}
            >
              <span aria-hidden="true">{group.shortLabel}</span>
              <span>
                <strong>{group.title}</strong>
                <small>{group.description}</small>
              </span>
            </button>
          ))}
        </nav>

        <div className={styles.settingsContent}>
          <div className={styles.contentHeader}>
            <div>
              <p className={styles.sectionEyebrow}>Раздел настроек</p>
              <h2>{activeGroupMeta.title}</h2>
              <span>{activeGroupMeta.description}</span>
            </div>
          </div>

          <div className={styles.groupContent}>{renderGroup()}</div>

          <footer className={styles.actionBar}>
            <div>
              <strong>Изменения сохраняются только в этом браузере</strong>
              <span>Backend и профиль пользователя будут подключены отдельным этапом.</span>
            </div>
            <div>
              <button className={styles.secondaryButton} type="button" onClick={resetSettings}>
                Вернуть значения
              </button>
              <button className={styles.primaryButton} type="button" onClick={saveSettings}>
                Сохранить локально
              </button>
            </div>
          </footer>
        </div>
      </div>
    </section>
  );
}
