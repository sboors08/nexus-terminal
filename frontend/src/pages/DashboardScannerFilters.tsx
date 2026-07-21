import {
  countActiveScannerFilters,
  type ScannerFilterState,
  type ScannerSortKey,
} from '@/shared/realtime';
import styles from './DashboardScannerFilters.module.css';

interface DashboardScannerFiltersProps {
  open: boolean;
  value: ScannerFilterState;
  onChange: (
    value: ScannerFilterState,
  ) => void;
  onApply: () => void;
  onReset: () => void;
  onClose: () => void;
}

interface NumberFilterProps {
  label: string;
  value: number | null;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  onChange: (
    value: number | null,
  ) => void;
}

const SORT_OPTIONS: Array<{
  value: ScannerSortKey;
  label: string;
}> = [
  {
    value: 'activity',
    label: 'Активность',
  },
  {
    value: 'quoteVolume',
    label: 'Объём',
  },
  {
    value: 'tradesCount',
    label: 'Количество сделок',
  },
  {
    value: 'speed',
    label: 'Скорость сделок',
  },
  {
    value: 'volatility',
    label: 'Волатильность',
  },
  {
    value: 'liquidity',
    label: 'Ликвидность',
  },
  {
    value: 'btcCorrelation',
    label: 'Связь с BTC',
  },
  {
    value: 'relativeStrength',
    label: 'Сила против BTC',
  },
];

function parseOptionalNumber(
  rawValue: string,
): number | null {
  const normalized =
    rawValue.trim();

  if (!normalized) {
    return null;
  }

  const parsed =
    Number(normalized);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function NumberFilter({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: NumberFilterProps) {
  return (
    <label className={styles.field}>
      <span>{label}</span>

      <div className={styles.numberInput}>
        <input
          type="number"
          value={value ?? ''}
          min={min}
          max={max}
          step={step}
          placeholder="Не задано"
          onChange={(event) => {
            onChange(
              parseOptionalNumber(
                event.currentTarget.value,
              ),
            );
          }}
        />

        {suffix ? (
          <small>{suffix}</small>
        ) : null}
      </div>
    </label>
  );
}

export function DashboardScannerFilters({
  open,
  value,
  onChange,
  onApply,
  onReset,
  onClose,
}: DashboardScannerFiltersProps) {
  if (!open) {
    return null;
  }

  const activeCount =
    countActiveScannerFilters(value);

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={(event) => {
        if (
          event.target
          === event.currentTarget
        ) {
          onClose();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          onClose();
        }
      }}
    >
      <form
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="scanner-filter-title"
        onSubmit={(event) => {
          event.preventDefault();
          onApply();
        }}
      >
        <header className={styles.header}>
          <div>
            <span>MARKET SCANNER</span>

            <h2 id="scanner-filter-title">
              ФИЛЬТРЫ И СОРТИРОВКА
            </h2>

            <small>
              Активных фильтров: {activeCount}
            </small>
          </div>

          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Закрыть фильтры"
          >
            ×
          </button>
        </header>

        <div className={styles.searchSection}>
          <label className={styles.field}>
            <span>ПОИСК МОНЕТЫ</span>

            <input
              type="search"
              value={value.query}
              placeholder="Например: SOL или SOL/USDT"
              onChange={(event) => {
                onChange({
                  ...value,
                  query:
                    event.currentTarget.value,
                });
              }}
            />
          </label>

          <label className={styles.liveToggle}>
            <input
              type="checkbox"
              checked={value.onlyLive}
              onChange={(event) => {
                onChange({
                  ...value,
                  onlyLive:
                    event.currentTarget.checked,
                });
              }}
            />

            <span>
              Только монеты с LIVE-данными
            </span>
          </label>
        </div>

        <div className={styles.metricsGrid}>
          <NumberFilter
            label="МИН. АКТИВНОСТЬ"
            value={value.minActivityScore}
            min={0}
            max={100}
            suffix="/ 100"
            onChange={(nextValue) => {
              onChange({
                ...value,
                minActivityScore:
                  nextValue,
              });
            }}
          />

          <NumberFilter
            label="МИН. ОБЪЁМ"
            value={value.minQuoteVolume}
            min={0}
            step={1000}
            suffix="USDT"
            onChange={(nextValue) => {
              onChange({
                ...value,
                minQuoteVolume:
                  nextValue,
              });
            }}
          />

          <NumberFilter
            label="МИН. СДЕЛОК"
            value={value.minTradesCount}
            min={0}
            suffix="сделок"
            onChange={(nextValue) => {
              onChange({
                ...value,
                minTradesCount:
                  nextValue,
              });
            }}
          />

          <NumberFilter
            label="МИН. СКОРОСТЬ"
            value={value.minTradesPerMinute}
            min={0}
            suffix="/ мин"
            onChange={(nextValue) => {
              onChange({
                ...value,
                minTradesPerMinute:
                  nextValue,
              });
            }}
          />

          <NumberFilter
            label="МИН. ВОЛАТИЛЬНОСТЬ"
            value={value.minVolatilityPct}
            min={0}
            step={0.01}
            suffix="%"
            onChange={(nextValue) => {
              onChange({
                ...value,
                minVolatilityPct:
                  nextValue,
              });
            }}
          />

          <NumberFilter
            label="МИН. ЛИКВИДНОСТЬ"
            value={value.minLiquidityScore}
            min={0}
            max={9}
            suffix="/ 9"
            onChange={(nextValue) => {
              onChange({
                ...value,
                minLiquidityScore:
                  nextValue,
              });
            }}
          />

          <NumberFilter
            label="МИН. СВЯЗЬ С BTC"
            value={value.minBtcCorrelation}
            min={-1}
            max={1}
            step={0.01}
            suffix="-1…1"
            onChange={(nextValue) => {
              onChange({
                ...value,
                minBtcCorrelation:
                  nextValue,
              });
            }}
          />

          <NumberFilter
            label="МИН. СИЛА ПРОТИВ BTC"
            value={value.minRelativeStrengthPct}
            step={0.01}
            suffix="%"
            onChange={(nextValue) => {
              onChange({
                ...value,
                minRelativeStrengthPct:
                  nextValue,
              });
            }}
          />
        </div>

        <div className={styles.sortGrid}>
          <label className={styles.field}>
            <span>СОРТИРОВАТЬ ПО</span>

            <select
              value={value.sortBy}
              onChange={(event) => {
                onChange({
                  ...value,
                  sortBy:
                    event.currentTarget
                      .value as ScannerSortKey,
                });
              }}
            >
              {SORT_OPTIONS.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>НАПРАВЛЕНИЕ</span>

            <select
              value={value.sortDirection}
              onChange={(event) => {
                onChange({
                  ...value,
                  sortDirection:
                    event.currentTarget.value
                      === 'asc'
                      ? 'asc'
                      : 'desc',
                });
              }}
            >
              <option value="desc">
                По убыванию
              </option>

              <option value="asc">
                По возрастанию
              </option>
            </select>
          </label>
        </div>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.resetButton}
            onClick={onReset}
          >
            СБРОСИТЬ
          </button>

          <div>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
            >
              ОТМЕНА
            </button>

            <button
              type="submit"
              className={styles.applyButton}
            >
              ПРИМЕНИТЬ
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}