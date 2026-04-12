import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  CrosshairMode,
  LineStyle,
  CandlestickSeries,
  AreaSeries,
  HistogramSeries,
} from 'lightweight-charts';
import { getHistoricalData } from '../../services/yahooStockApi';
import './StockChart.css';

const TIMEFRAMES = ['1D', '1W', '1M', '6M', '1Y', 'MAX'];
const CHART_TYPES = ['Candlestick', 'Line'];

const C = {
  bg:        '#0d0e12',
  text:      '#bbc9cf',
  grid:      'rgba(60, 73, 78, 0.3)',
  crosshair: '#00d4ff',
  up:        '#00c896',
  down:      '#ff4757',
  border:    'rgba(60, 73, 78, 0.5)',
  lineColor: '#00d4ff',
  areaTop:   'rgba(0, 212, 255, 0.22)',
  areaBot:   'rgba(0, 212, 255, 0.0)',
};

/**
 * Premium TradingView-style chart — lightweight-charts v5.
 *
 * Props:
 *  symbol    {string}  Ticker (e.g. 'RELIANCE.NS')
 *  livePrice {number}  Latest polled price — used to update the last candle
 *  height    {number}  Chart container height in px (default 400)
 */
export default function StockChart({ symbol, livePrice, height = 400 }) {
  const containerRef   = useRef(null);
  const chartRef       = useRef(null);
  const candleRef      = useRef(null);
  const lineRef        = useRef(null);
  const volumeRef      = useRef(null);

  const [timeframe, setTimeframe] = useState('1M');
  const [chartType, setChartType] = useState('Candlestick');
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [tooltip, setTooltip]     = useState(null);

  // ── Create chart once ────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: C.bg },
        textColor: C.text,
        fontSize: 11,
        fontFamily: "'Inter', system-ui, sans-serif",
      },
      grid: {
        vertLines: { color: C.grid, style: LineStyle.Dotted },
        horzLines: { color: C.grid, style: LineStyle.Dotted },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: C.crosshair, width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#1a1b25' },
        horzLine: { color: C.crosshair, width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#1a1b25' },
      },
      rightPriceScale: { borderColor: C.border, scaleMargins: { top: 0.1, bottom: 0.3 } },
      timeScale: { borderColor: C.border, timeVisible: true, secondsVisible: false },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale:  { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
      width:  containerRef.current.clientWidth,
      height: height,
    });
    chartRef.current = chart;

    candleRef.current = chart.addSeries(CandlestickSeries, {
      upColor: C.up, downColor: C.down,
      borderUpColor: C.up, borderDownColor: C.down,
      wickUpColor: C.up, wickDownColor: C.down,
      visible: true,
    });

    lineRef.current = chart.addSeries(AreaSeries, {
      lineColor: C.lineColor,
      topColor: C.areaTop,
      bottomColor: C.areaBot,
      lineWidth: 2,
      visible: false,
    });

    volumeRef.current = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    // OHLC crosshair tooltip
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point) { setTooltip(null); return; }
      const candle = param.seriesData.get(candleRef.current);
      const line   = param.seriesData.get(lineRef.current);
      if (candle) setTooltip({ time: param.time, ...candle });
      else if (line) setTooltip({ time: param.time, close: line.value });
    });

    // Responsive width
    const ro = new ResizeObserver(() => {
      containerRef.current && chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = candleRef.current = lineRef.current = volumeRef.current = null;
    };
  }, [height]);

  // ── Fetch Yahoo Finance candle data ──────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!symbol || !candleRef.current) return;
    setLoading(true);
    setError(null);
    try {
      const { candles, volumes } = await getHistoricalData(symbol, timeframe);

      if (!candles.length) {
        setError('No historical data available for this symbol / timeframe.');
        return;
      }

      candleRef.current.setData(candles);
      lineRef.current?.setData(candles.map((c) => ({ time: c.time, value: c.close })));
      volumeRef.current?.setData(volumes);
      chartRef.current?.timeScale().fitContent();
    } catch (err) {
      setError(err.message || 'Failed to load chart data.');
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Show / hide series on chart-type toggle ──────────────────────────────
  useEffect(() => {
    candleRef.current?.applyOptions({ visible: chartType === 'Candlestick' });
    lineRef.current?.applyOptions({ visible: chartType === 'Line' });
  }, [chartType]);

  // ── Nudge last candle on each polling tick ───────────────────────────────
  useEffect(() => {
    if (!livePrice || !candleRef.current) return;
    const t = Math.floor(Date.now() / 1000);
    try {
      candleRef.current.update({ time: t, open: livePrice, high: livePrice, low: livePrice, close: livePrice });
      lineRef.current?.update({ time: t, value: livePrice });
    } catch (_) { /* ignore if no data loaded yet */ }
  }, [livePrice]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const fmt = (n) => (n != null ? Number(n).toFixed(2) : '—');

  const formatTime = (t) => {
    if (!t) return '';
    try {
      const d = typeof t === 'object'
        ? new Date(`${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`)
        : new Date(t * 1000);
      return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return ''; }
  };

  return (
    <div className="stock-chart-wrapper">
      {/* Controls */}
      <div className="chart-controls">
        <div className="chart-type-toggle">
          {CHART_TYPES.map((t) => (
            <button
              key={t}
              id={`chart-type-${t.toLowerCase()}`}
              className={`chart-type-btn${chartType === t ? ' active' : ''}`}
              onClick={() => setChartType(t)}
            >
              {t === 'Candlestick' ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="5" y="2" width="4" height="10" rx="1" fill="currentColor" opacity=".8"/>
                  <line x1="7" y1="0" x2="7" y2="2"  stroke="currentColor" strokeWidth="1.5"/>
                  <line x1="7" y1="12" x2="7" y2="14" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <polyline points="0,10 4,6 7,8 10,4 14,2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                </svg>
              )}
              {t}
            </button>
          ))}
        </div>

        <div className="timeframe-buttons">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              id={`timeframe-${tf}`}
              className={`tf-btn${timeframe === tf ? ' active' : ''}`}
              onClick={() => setTimeframe(tf)}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Chart canvas */}
      <div className="chart-area" style={{ height }}>
        <div ref={containerRef} className="chart-canvas" style={{ width: '100%', height: '100%' }} />

        {/* OHLC tooltip */}
        {tooltip && (
          <div className="chart-tooltip">
            <span className="tt-date">{formatTime(tooltip.time)}</span>
            {tooltip.open !== undefined && (
              <>
                <span className="tt-item"><em>O</em> {fmt(tooltip.open)}</span>
                <span className="tt-item"><em>H</em> {fmt(tooltip.high)}</span>
                <span className="tt-item"><em>L</em> {fmt(tooltip.low)}</span>
                <span className={`tt-item ${tooltip.close >= tooltip.open ? 'up' : 'down'}`}>
                  <em>C</em> {fmt(tooltip.close)}
                </span>
              </>
            )}
            {tooltip.open === undefined && (
              <span className="tt-item tt-price">{fmt(tooltip.close ?? tooltip.value)}</span>
            )}
          </div>
        )}

        {loading && (
          <div className="chart-overlay">
            <div className="chart-spinner" />
            <span>Loading {symbol}…</span>
          </div>
        )}

        {!loading && error && (
          <div className="chart-overlay chart-error">
            <svg width="24" height="24" fill="none" stroke="#ff4757" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <circle cx="12" cy="16" r=".5" fill="#ff4757"/>
            </svg>
            <span>{error}</span>
            <button onClick={loadData} className="retry-btn">Retry</button>
          </div>
        )}
      </div>
    </div>
  );
}
