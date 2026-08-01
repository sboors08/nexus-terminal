import type {
  ScannerSetup,
  ScannerSetupKind,
} from '../../../features/scanner/scannerData.js';
import type {
  LevelV2ShadowLifecycleState,
  LevelV2ShadowLifecycleStatus,
  LevelV2ShadowSnapshot,
} from './levelV2ShadowApi.js';

function formatPrice(
  value: number,
): string {
  const absolute =
    Math.abs(value);

  const digits =
    absolute >= 1000
      ? 2
      : absolute >= 1
        ? 4
        : 8;

  return value.toLocaleString(
    'en-US',
    {
      useGrouping:
        false,
      maximumFractionDigits:
        digits,
    },
  );
}

function formatFormation(
  registeredAt: string,
  generatedAt: string,
): {
  minutes: number;
  label: string;
} {
  const registered =
    Date.parse(registeredAt);

  const generated =
    Date.parse(generatedAt);

  const minutes =
    Number.isFinite(registered)
    && Number.isFinite(generated)
      ? Math.max(
          0,
          Math.floor(
            (
              generated
              - registered
            )
            / 60_000,
          ),
        )
      : 0;

  const hours =
    Math.floor(
      minutes / 60,
    );

  const remainingMinutes =
    minutes % 60;

  return {
    minutes,
    label:
      hours > 0
        ? `${hours}\u0447 ${String(
            remainingMinutes,
          ).padStart(
            2,
            '0',
          )}\u043c`
        : `${remainingMinutes}\u043c`,
  };
}

function mapLifecycleStage(
  status:
    LevelV2ShadowLifecycleStatus,
): ScannerSetup['stage'] {
  if (
    status === 'testing'
    || status === 'retest_pending'
  ) {
    return 'confirmation';
  }

  if (
    status === 'broken'
    || status === 'flipped'
  ) {
    return 'triggered';
  }

  if (status === 'active') {
    return 'approach';
  }

  return 'observation';
}

function mapLevelKind(
  state:
    LevelV2ShadowLifecycleState,
): ScannerSetupKind {
  return state.currentKind
    === 'support'
      ? '\u0423\u0440\u043e\u0432\u0435\u043d\u044c \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0438'
      : '\u0423\u0440\u043e\u0432\u0435\u043d\u044c \u0441\u043e\u043f\u0440\u043e\u0442\u0438\u0432\u043b\u0435\u043d\u0438\u044f';
}

function mapShadowLevel(
  snapshot:
    LevelV2ShadowSnapshot,
  state:
    LevelV2ShadowLifecycleState,
): ScannerSetup {
  const direction =
    state.currentKind
    === 'support'
      ? 'long'
      : 'short';

  const formation =
    formatFormation(
      state.registeredAt,
      snapshot.generatedAt,
    );

  const zone =
    state.level.zone;

  const chartPath =
    direction === 'long'
      ? 'M0 174 C70 168 125 154 180 160 C245 166 300 138 360 143 C425 148 490 119 550 126 C590 130 616 112 640 108'
      : 'M0 36 C70 42 125 58 180 53 C245 47 300 75 360 70 C425 65 490 94 550 88 C590 84 616 102 640 106';

  return {
    id:
      `v2-shadow:${state.id}`,

    symbol:
      snapshot.symbol,

    exchange:
      'BINANCE',

    direction,

    kind:
      mapLevelKind(
        state,
      ),

    stage:
      mapLifecycleStage(
        state.status,
      ),

    timeframe:
      '1m',

    price:
      '\u2014',

    priceChange:
      '\u2014',

    level:
      formatPrice(
        zone.coreLow,
      )
      + '\u2013'
      + formatPrice(
          zone.coreHigh,
        ),

    distancePercent:
      Number.POSITIVE_INFINITY,

    distanceLabel:
      '\u2014',

    touches:
      state.qualifiedTouchesCount,

    formationMinutes:
      formation.minutes,

    formationLabel:
      formation.label,

    pullbackDepth:
      '\u2014',

    volumeAnomaly:
      null,

    tradesAnomaly:
      null,

    tradeSpeed:
      '\u0414\u0430\u043d\u043d\u044b\u0435 \u0441\u043e\u0431\u0438\u0440\u0430\u044e\u0442\u0441\u044f',

    btcCorrelation:
      '\u2014',

    btcStrength:
      null,

    btcStrengthLabel:
      '\u2014',

    activity:
      '\u0421\u0440\u0435\u0434\u043d\u044f\u044f',

    reasons: [
      'Level v2 Shadow: \u0443\u0440\u043e\u0432\u0435\u043d\u044c \u043d\u0435 \u0443\u0447\u0430\u0441\u0442\u0432\u0443\u0435\u0442 \u0432 production-\u0441\u0435\u0442\u0430\u043f\u0430\u0445.',
      '\u0421\u0442\u0430\u0442\u0443\u0441 \u0436\u0438\u0437\u043d\u0435\u043d\u043d\u043e\u0433\u043e \u0446\u0438\u043a\u043b\u0430: '
        + state.status
        + '.',
      '\u041e\u0446\u0435\u043d\u043a\u0430 \u043a\u0430\u0447\u0435\u0441\u0442\u0432\u0430 \u0443\u0440\u043e\u0432\u043d\u044f: '
        + state.level.score.total
            .toFixed(1)
        + '/100.',
    ],

    chartPath,

    areaPath:
      chartPath
      + ' L640 210 L0 210 Z',

    levelY:
      106,

    touchPoints: [
      {
        x:
          470,
        y:
          108,
      },
      {
        x:
          555,
        y:
          105,
      },
    ],

    source:
      'v2-shadow',

    levelLow:
      zone.coreLow,

    levelHigh:
      zone.coreHigh,

    levelReferencePrice:
      zone.referencePrice,

    levelActiveFrom:
      state.registeredAt,

    shadowScore:
      state.level.score.total,

    shadowStatus:
      state.status,

    runtimeData:
      true,
  };
}

export function mapLevelV2ShadowSnapshotsToScannerSetups(
  snapshots:
    readonly LevelV2ShadowSnapshot[],
): ScannerSetup[] {
  return snapshots.flatMap(
    (snapshot) =>
      snapshot.levels
        .filter(
          (state) =>
            state.eligibleForSetups,
        )
        .map(
          (state) =>
            mapShadowLevel(
              snapshot,
              state,
            ),
        ),
  );
}
