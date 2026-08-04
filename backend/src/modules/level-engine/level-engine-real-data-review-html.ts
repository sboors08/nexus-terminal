import type {
  LevelEngineRealDataValidationReport,
} from './level-engine-real-data-validation.types.js';

function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

export function buildLevelEngineRealDataReviewHtml(
  report: LevelEngineRealDataValidationReport,
): string {
  const datasets = report.symbolReports.flatMap((symbolReport) =>
    symbolReport.datasets.map((dataset) => ({
      key: `${dataset.symbol}:${dataset.sourceTimeframe}`,
      symbol: dataset.symbol,
      sourceTimeframe: dataset.sourceTimeframe,
      candles: dataset.candles,
    })),
  );
  const items = report.symbolReports.flatMap((symbolReport) =>
    symbolReport.reviewQueue.map((item) => ({
      key: item.candidate.id,
      symbol: symbolReport.symbol,
      sourceTimeframe: item.candidate.sourceTimeframe,
      reviewOrder: item.reviewOrder,
      candidate: item.candidate,
      diagnostic: item.diagnostic,
    })),
  );
  const payload = safeJson({
    reviewDiagnosticsVersion: report.reviewDiagnosticsVersion,
    generatedAt: report.generatedAt,
    reviewPolicy: report.reviewPolicy,
    totals: report.totals,
    datasets,
    items,
  });

  const template = String.raw`<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>NEXUS Level Review</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, Segoe UI, sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #080b11; color: #e8edf5; }
    header { position: sticky; top: 0; z-index: 10; padding: 14px 18px; background: rgba(8,11,17,.96); border-bottom: 1px solid #202838; backdrop-filter: blur(10px); }
    h1 { margin: 0 0 4px; font-size: 18px; }
    .muted { color: #8995aa; font-size: 12px; }
    .controls { display: grid; grid-template-columns: repeat(4,minmax(130px,1fr)); gap: 10px; margin-top: 12px; }
    select, textarea, button { background: #111722; color: #e8edf5; border: 1px solid #2a3447; border-radius: 8px; padding: 9px 10px; }
    button { cursor: pointer; }
    button:hover { border-color: #53617a; }
    main { padding: 16px 18px 32px; }
    .summary { display: grid; grid-template-columns: repeat(4,minmax(120px,1fr)); gap: 10px; margin-bottom: 14px; }
    .card { background: #0e141e; border: 1px solid #202838; border-radius: 10px; padding: 12px; }
    .metric { font-size: 20px; font-weight: 700; margin-top: 4px; }
    .badge { display: inline-flex; align-items: center; border-radius: 999px; padding: 4px 8px; font-size: 12px; font-weight: 700; text-transform: uppercase; }
    .active { background: #143923; color: #7ce7a1; }
    .broken { background: #431b22; color: #ff8b9b; }
    .stale { background: #3a3116; color: #e7cb78; }
    .pending { background: #24344c; color: #9bc5ff; }
    .layout { display: grid; grid-template-columns: minmax(0,1fr) 310px; gap: 14px; }
    .chart-card { min-width: 0; }
    .chart-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 10px; }
    .chart-title { font-size: 16px; font-weight: 700; }
    .canvas-wrap { overflow: auto; border: 1px solid #202838; border-radius: 8px; background: #0a0f17; }
    canvas { display: block; }
    dl { display: grid; grid-template-columns: 1fr 1.2fr; gap: 7px 10px; margin: 0; font-size: 12px; }
    dt { color: #8995aa; }
    dd { margin: 0; word-break: break-word; }
    .labels { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; margin: 12px 0; }
    .labels button.selected { outline: 2px solid #9bc5ff; }
    textarea { width: 100%; min-height: 96px; resize: vertical; }
    .legend { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 10px; color: #8995aa; font-size: 12px; }
    .legend span::before { content: ''; display: inline-block; width: 12px; height: 3px; margin-right: 5px; vertical-align: middle; background: var(--legend); }
    .empty { padding: 40px; text-align: center; color: #8995aa; }
    @media (max-width: 1000px) { .layout { grid-template-columns: 1fr; } .controls { grid-template-columns: 1fr 1fr; } }
  </style>
</head>
<body>
<header>
  <h1>NEXUS · Level Review</h1>
  <div class="muted" id="generated"></div>
  <div class="controls">
    <select id="symbolFilter"></select>
    <select id="timeframeFilter"></select>
    <select id="stateFilter"></select>
    <select id="itemSelect"></select>
  </div>
</header>
<main>
  <div class="summary" id="summary"></div>
  <div class="layout">
    <section class="card chart-card">
      <div class="chart-head">
        <div>
          <div class="chart-title" id="chartTitle">—</div>
          <div class="muted" id="chartSubtitle">—</div>
        </div>
        <span class="badge pending" id="stateBadge">pending</span>
      </div>
      <div class="canvas-wrap" id="canvasWrap"><canvas id="chart"></canvas></div>
      <div class="legend">
        <span style="--legend:#8b5cf6">зона уровня</span>
        <span style="--legend:#60a5fa">касания</span>
        <span style="--legend:#f59e0b">detectedAt</span>
        <span style="--legend:#ef4444">break</span>
      </div>
    </section>
    <aside class="card">
      <dl id="details"></dl>
      <div class="labels" id="labels"></div>
      <textarea id="note" placeholder="Комментарий к уровню"></textarea>
      <button id="saveNote" style="width:100%;margin-top:7px">Сохранить оценку</button>
      <button id="exportLabels" style="width:100%;margin-top:7px">Экспортировать оценки JSON</button>
    </aside>
  </div>
</main>
<script id="payload" type="application/json">__LEVEL_ENGINE_REVIEW_PAYLOAD__</script>
<script>
(function () {
  'use strict';
  var payload = JSON.parse(document.getElementById('payload').textContent);
  var datasetMap = new Map(payload.datasets.map(function (dataset) { return [dataset.key, dataset]; }));
  var labelsKey = 'nexus-level-review-labels-v0.1';
  var saved = JSON.parse(localStorage.getItem(labelsKey) || '{}');
  var filteredItems = [];
  var currentItem = null;
  var labelValues = ['good','borderline','junk','flip','broken','single_candle_false_level'];
  var labelNames = {
    good: 'Хороший', borderline: 'Пограничный', junk: 'Мусор', flip: 'Flip',
    broken: 'Сломан', single_candle_false_level: 'Одна свеча'
  };
  var stateNames = { active: 'active', broken: 'broken', stale: 'stale', pending: 'pending' };

  var symbolFilter = document.getElementById('symbolFilter');
  var timeframeFilter = document.getElementById('timeframeFilter');
  var stateFilter = document.getElementById('stateFilter');
  var itemSelect = document.getElementById('itemSelect');
  var canvas = document.getElementById('chart');
  var wrap = document.getElementById('canvasWrap');
  var context = canvas.getContext('2d');

  document.getElementById('generated').textContent = 'Отчёт: ' + payload.generatedAt;

  function unique(values) { return Array.from(new Set(values)); }
  function fillSelect(select, values, allLabel) {
    select.innerHTML = '';
    var all = document.createElement('option'); all.value = ''; all.textContent = allLabel; select.appendChild(all);
    values.forEach(function (value) { var option = document.createElement('option'); option.value = value; option.textContent = value; select.appendChild(option); });
  }

  fillSelect(symbolFilter, unique(payload.items.map(function (item) { return item.symbol; })), 'Все монеты');
  fillSelect(timeframeFilter, ['1m','5m','15m','1h','4h'], 'Все таймфреймы');
  fillSelect(stateFilter, ['active','broken','stale','pending'], 'Все состояния');

  function applyFilters() {
    filteredItems = payload.items.filter(function (item) {
      return (!symbolFilter.value || item.symbol === symbolFilter.value)
        && (!timeframeFilter.value || item.sourceTimeframe === timeframeFilter.value)
        && (!stateFilter.value || item.diagnostic.state === stateFilter.value);
    });
    itemSelect.innerHTML = '';
    filteredItems.forEach(function (item, index) {
      var option = document.createElement('option');
      option.value = item.key;
      option.textContent = String(index + 1) + '. ' + item.symbol + ' ' + item.sourceTimeframe + ' · ' + item.candidate.kind + ' · ' + item.diagnostic.state;
      itemSelect.appendChild(option);
    });
    currentItem = filteredItems[0] || null;
    render();
  }

  function formatNumber(value) {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—';
    return Math.abs(value) >= 1000 ? value.toLocaleString('ru-RU', { maximumFractionDigits: 2 }) : value.toLocaleString('ru-RU', { maximumFractionDigits: 6 });
  }

  function nearestCandleIndex(candles, timestamp) {
    var target = Date.parse(timestamp);
    var best = 0; var bestDistance = Infinity;
    candles.forEach(function (candle, index) {
      var distance = Math.abs(Date.parse(candle.closeTime) - target);
      if (distance < bestDistance) { bestDistance = distance; best = index; }
    });
    return best;
  }

  function drawVertical(index, xFor, top, bottom, color, label) {
    var x = xFor(index);
    context.strokeStyle = color; context.lineWidth = 1; context.setLineDash([5,4]);
    context.beginPath(); context.moveTo(x, top); context.lineTo(x, bottom); context.stroke(); context.setLineDash([]);
    context.fillStyle = color; context.font = '11px Segoe UI'; context.fillText(label, x + 3, top + 13);
  }

  function drawChart(item) {
    var dataset = datasetMap.get(item.symbol + ':' + item.sourceTimeframe);
    if (!dataset || dataset.candles.length === 0) return;
    var candles = dataset.candles;
    var candleWidth = 7;
    var left = 64; var top = 28; var bottomPad = 34; var right = 26;
    canvas.width = Math.max(wrap.clientWidth - 2, left + right + candles.length * candleWidth);
    canvas.height = 570;
    var bottom = canvas.height - bottomPad;
    context.clearRect(0, 0, canvas.width, canvas.height);

    var prices = [];
    candles.forEach(function (candle) { prices.push(candle.high, candle.low); });
    prices.push(item.candidate.zone.high, item.candidate.zone.low);
    var minimum = Math.min.apply(null, prices); var maximum = Math.max.apply(null, prices);
    var padding = Math.max((maximum - minimum) * .05, maximum * .0001);
    minimum -= padding; maximum += padding;
    function y(price) { return top + (maximum - price) / (maximum - minimum) * (bottom - top); }
    function x(index) { return left + index * candleWidth + candleWidth / 2; }

    context.strokeStyle = '#202838'; context.lineWidth = 1;
    for (var grid = 0; grid <= 5; grid += 1) {
      var gy = top + (bottom - top) * grid / 5;
      context.beginPath(); context.moveTo(left, gy); context.lineTo(canvas.width - right, gy); context.stroke();
      var price = maximum - (maximum - minimum) * grid / 5;
      context.fillStyle = '#8995aa'; context.font = '11px Segoe UI'; context.fillText(formatNumber(price), 4, gy + 4);
    }

    var activeIndex = nearestCandleIndex(candles, item.candidate.activeFrom);
    context.fillStyle = 'rgba(139,92,246,.18)';
    context.fillRect(x(activeIndex), y(item.candidate.zone.high), canvas.width - right - x(activeIndex), y(item.candidate.zone.low) - y(item.candidate.zone.high));
    context.strokeStyle = '#8b5cf6'; context.lineWidth = 1;
    [item.candidate.zone.low, item.candidate.zone.reference, item.candidate.zone.high].forEach(function (price) {
      context.beginPath(); context.moveTo(x(activeIndex), y(price)); context.lineTo(canvas.width - right, y(price)); context.stroke();
    });

    candles.forEach(function (candle, index) {
      var rising = candle.close >= candle.open;
      var color = rising ? '#27c47d' : '#ef5b6b';
      var cx = x(index);
      context.strokeStyle = color; context.lineWidth = 1;
      context.beginPath(); context.moveTo(cx, y(candle.high)); context.lineTo(cx, y(candle.low)); context.stroke();
      var bodyTop = y(Math.max(candle.open, candle.close));
      var bodyBottom = y(Math.min(candle.open, candle.close));
      context.fillStyle = color;
      context.fillRect(cx - 2, bodyTop, 4, Math.max(1, bodyBottom - bodyTop));
    });

    item.candidate.touchEpisodes.forEach(function (episode, index) {
      var touchIndex = nearestCandleIndex(candles, episode.anchorAt);
      drawVertical(touchIndex, x, top, bottom, '#60a5fa', 'T' + String(index + 1));
    });
    var detectedIndex = nearestCandleIndex(candles, item.candidate.detectedAt);
    drawVertical(detectedIndex, x, top, bottom, '#f59e0b', 'detected');
    if (item.diagnostic.breakEvidence) {
      drawVertical(item.diagnostic.breakEvidence.candleIndex, x, top, bottom, '#ef4444', 'break');
    }

    for (var tick = 0; tick < candles.length; tick += 100) {
      context.fillStyle = '#8995aa'; context.font = '10px Segoe UI';
      context.fillText(candles[tick].openTime.slice(5,16).replace('T',' '), x(tick) - 28, canvas.height - 10);
    }

    requestAnimationFrame(function () {
      var focusIndex = item.diagnostic.breakEvidence ? item.diagnostic.breakEvidence.candleIndex : detectedIndex;
      wrap.scrollLeft = Math.max(0, x(focusIndex) - wrap.clientWidth * .55);
    });
  }

  function renderDetails(item) {
    var candidate = item.candidate; var diagnostic = item.diagnostic;
    var rows = [
      ['ID', candidate.id], ['Тип', candidate.kind], ['Зона', formatNumber(candidate.zone.low) + ' — ' + formatNumber(candidate.zone.high)],
      ['Reference', formatNumber(candidate.zone.reference)], ['Maturity', candidate.maturity], ['Касаний', candidate.touchEpisodes.length],
      ['activeFrom', candidate.activeFrom], ['detectedAt', candidate.detectedAt], ['Текущая цена', formatNumber(diagnostic.currentPrice)],
      ['Расстояние ATR', formatNumber(diagnostic.distanceFromZoneAtr)], ['Свечей после detection', diagnostic.futureClosedCandlesCount],
      ['После последнего касания', diagnostic.barsSinceLastInteraction === null ? '—' : diagnostic.barsSinceLastInteraction],
      ['Break mode', diagnostic.breakEvidence ? diagnostic.breakEvidence.mode : '—'],
      ['Broken at', diagnostic.breakEvidence ? diagnostic.breakEvidence.brokenAt : '—']
    ];
    document.getElementById('details').innerHTML = rows.map(function (row) { return '<dt>' + row[0] + '</dt><dd>' + row[1] + '</dd>'; }).join('');
  }

  function renderLabels(item) {
    var container = document.getElementById('labels'); container.innerHTML = '';
    var current = saved[item.key] || {};
    labelValues.forEach(function (value) {
      var button = document.createElement('button'); button.textContent = labelNames[value]; button.dataset.value = value;
      if (current.label === value) button.classList.add('selected');
      button.addEventListener('click', function () {
        current.label = value; saved[item.key] = current; localStorage.setItem(labelsKey, JSON.stringify(saved)); renderLabels(item);
      });
      container.appendChild(button);
    });
    document.getElementById('note').value = current.note || '';
  }

  function renderSummary() {
    var counts = { active: 0, broken: 0, stale: 0, pending: 0 };
    payload.items.forEach(function (item) { counts[item.diagnostic.state] += 1; });
    document.getElementById('summary').innerHTML = Object.keys(counts).map(function (state) {
      return '<div class="card"><div class="muted">' + stateNames[state] + '</div><div class="metric">' + counts[state] + '</div></div>';
    }).join('');
  }

  function render() {
    if (!currentItem) {
      document.getElementById('chartTitle').textContent = 'Нет уровней по фильтру';
      context.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    itemSelect.value = currentItem.key;
    document.getElementById('chartTitle').textContent = currentItem.symbol + ' · ' + currentItem.sourceTimeframe + ' · ' + currentItem.candidate.kind;
    document.getElementById('chartSubtitle').textContent = currentItem.candidate.id;
    var badge = document.getElementById('stateBadge'); badge.textContent = currentItem.diagnostic.state; badge.className = 'badge ' + currentItem.diagnostic.state;
    renderDetails(currentItem); renderLabels(currentItem); drawChart(currentItem);
  }

  [symbolFilter, timeframeFilter, stateFilter].forEach(function (select) { select.addEventListener('change', applyFilters); });
  itemSelect.addEventListener('change', function () { currentItem = filteredItems.find(function (item) { return item.key === itemSelect.value; }) || null; render(); });
  window.addEventListener('resize', function () { if (currentItem) drawChart(currentItem); });
  document.getElementById('saveNote').addEventListener('click', function () {
    if (!currentItem) return; var current = saved[currentItem.key] || {}; current.note = document.getElementById('note').value; saved[currentItem.key] = current; localStorage.setItem(labelsKey, JSON.stringify(saved));
  });
  document.getElementById('exportLabels').addEventListener('click', function () {
    var exportValue = { exportedAt: new Date().toISOString(), reportGeneratedAt: payload.generatedAt, labels: saved };
    var blob = new Blob([JSON.stringify(exportValue, null, 2) + '\n'], { type: 'application/json' });
    var url = URL.createObjectURL(blob); var link = document.createElement('a'); link.href = url; link.download = 'nexus-level-review-labels.json'; link.click(); URL.revokeObjectURL(url);
  });

  renderSummary(); applyFilters();
}());
</script>
</body>
</html>`;

  return template.replace(
    '__LEVEL_ENGINE_REVIEW_PAYLOAD__',
    payload,
  );
}
