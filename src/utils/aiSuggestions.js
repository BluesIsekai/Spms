/**
 * aiSuggestions.js
 * ────────────────────────────────────────────────────────────────────────────
 * Rule-based AI engine for Buy / Sell / Hold suggestions.
 *
 * HOW IT WORKS (transparent logic, NOT random):
 * ─────────────────────────────────────────────
 * Each holding gets a score built from 3 real data components:
 *
 *  1. Overall P&L% (your cost vs current price) — the PRIMARY signal
 *     • Big profit (>20%)  → score drops → Book Profit / Sell
 *     • Moderate profit    → score stays neutral-positive → Hold / Buy
 *     • Small loss (-10%)  → score rises → Buy (dip opportunity)
 *     • Deep loss (>-20%)  → score drops → Sell (cut losses)
 *
 *  2. Today's momentum (daily % change) — SECONDARY signal
 *     • Recovering today while in loss → extra buy signal
 *     • Falling today while already profitable → extra sell signal
 *
 *  3. Portfolio concentration — RISK MODIFIER
 *     • Overweight stock (>35% of portfolio) → reduce score (diversify)
 *     • Underweight stock (<8%) → small boost (can add more)
 *
 * SCORE → ACTION mapping:
 *   >= 75  : 🚀 Strong Buy
 *   >= 60  : 📈 Buy More
 *   >= 44  : ✋ Hold
 *   >= 28  : 💰 Book Profit
 *   < 28   : 🔴 Consider Selling
 *
 * Values are derived 100% from your real portfolio data (live prices,
 * your actual buy price, and your portfolio weight). Nothing is random.
 * ────────────────────────────────────────────────────────────────────────────
 */

export function actionColor(action) {
  const map = {
    STRONG_BUY:  '#00C853',
    BUY:         '#00E676',
    HOLD:        '#FFD740',
    BOOK_PROFIT: '#FF6D00',
    SELL:        '#FF1744',
  };
  return map[action] ?? '#888';
}

export function actionLabel(action) {
  const map = {
    STRONG_BUY:  '🚀 Strong Buy',
    BUY:         '📈 Buy More',
    HOLD:        '✋ Hold',
    BOOK_PROFIT: '💰 Book Profit',
    SELL:        '🔴 Consider Selling',
  };
  return map[action] ?? action;
}

/**
 * Generate a suggestion for a single holding.
 * All inputs are real live data — nothing is random.
 */
export function generateSuggestion(holding, quote, portfolioWeight = 0) {
  const reasons = [];
  let score = 50; // neutral start

  const avgBuy    = Number(holding.average_buy_price) || 0;
  const curPrice  = Number(quote?.price) || avgBuy;
  const changePct = Number(quote?.changePct) || 0;
  const plPct     = avgBuy > 0 ? ((curPrice - avgBuy) / avgBuy) * 100 : 0;
  const weightPct = portfolioWeight * 100;

  // ── COMPONENT 1: Overall P&L from your buy price (PRIMARY, ±35 pts) ───────
  // This is the most important signal. Based on how much you've gained/lost
  // since you bought the stock.
  if (plPct >= 30) {
    score -= 35;
    reasons.push(`Massive gain of +${plPct.toFixed(1)}% from your buy price — strong signal to book profits before a reversal`);
  } else if (plPct >= 20) {
    score -= 22;
    reasons.push(`Strong gain of +${plPct.toFixed(1)}% — consider booking partial profits to lock in returns`);
  } else if (plPct >= 12) {
    score -= 10;
    reasons.push(`Good profit of +${plPct.toFixed(1)}% — hold and watch for further upside or partial exit`);
  } else if (plPct >= 5) {
    score += 5;
    reasons.push(`Moderate gain of +${plPct.toFixed(1)}% from your buy price — position is healthy`);
  } else if (plPct >= 0) {
    score += 12;
    reasons.push(`Slight gain of +${plPct.toFixed(1)}% — stock is near cost, good accumulation zone`);
  } else if (plPct >= -8) {
    score += 20;
    reasons.push(`Down ${Math.abs(plPct).toFixed(1)}% from your buy price — this is a typical dip, good zone to buy more`);
  } else if (plPct >= -18) {
    score += 12;
    reasons.push(`Down ${Math.abs(plPct).toFixed(1)}% from cost — significant drawdown; buy more only if fundamentals are strong`);
  } else if (plPct >= -28) {
    score -= 8;
    reasons.push(`Down ${Math.abs(plPct).toFixed(1)}% from cost — deep loss; consider averaging down carefully or exiting`);
  } else {
    score -= 25;
    reasons.push(`Down ${Math.abs(plPct).toFixed(1)}% from your buy price — heavy loss territory; review whether to cut losses`);
  }

  // ── COMPONENT 2: Today's market momentum (SECONDARY, ±18 pts) ────────────
  // Based on today's live % change. Gives directional momentum signal.
  if (changePct >= 4) {
    score += 18;
    reasons.push(`Very strong rally today (+${changePct.toFixed(2)}%) — high buying momentum in the market`);
  } else if (changePct >= 2) {
    score += 12;
    reasons.push(`Strong up day (+${changePct.toFixed(2)}%) — bullish momentum`);
  } else if (changePct >= 0.75) {
    score += 6;
    reasons.push(`Positive session today (+${changePct.toFixed(2)}%) — mild buying interest`);
  } else if (changePct >= -0.5) {
    // Near-flat day — no momentum signal
    reasons.push(`Relatively flat session (${changePct.toFixed(2)}%) — market is consolidating`);
  } else if (changePct >= -2) {
    score -= 8;
    reasons.push(`Weak session today (${changePct.toFixed(2)}%) — mild selling pressure`);
  } else if (changePct >= -4) {
    score -= 14;
    reasons.push(`Sharp fall today (${changePct.toFixed(2)}%) — significant selling pressure; wait for stabilisation`);
  } else {
    score -= 18;
    reasons.push(`Heavy selloff today (${changePct.toFixed(2)}%) — strong negative momentum; avoid adding today`);
  }

  // ── COMPONENT 3: Portfolio concentration (RISK MODIFIER, ±12 pts) ─────────
  // A stock taking too large a share of your portfolio is risky regardless of P&L.
  if (weightPct >= 45) {
    score -= 12;
    reasons.push(`Very high concentration: ${weightPct.toFixed(1)}% of your portfolio is in this one stock — rebalancing strongly recommended`);
  } else if (weightPct >= 30) {
    score -= 6;
    reasons.push(`High portfolio weight (${weightPct.toFixed(1)}%) — consider diversifying to reduce single-stock risk`);
  } else if (weightPct <= 5 && weightPct > 0) {
    score += 5;
    reasons.push(`Small position (${weightPct.toFixed(1)}% of portfolio) — room to add more if signal is positive`);
  } else {
    reasons.push(`Portfolio weight: ${weightPct.toFixed(1)}% — well balanced`);
  }

  // ── BONUS RULES: Special market scenarios ─────────────────────────────────
  // Dip on a winner: stock is falling today but you're still up overall
  if (changePct < -1.5 && plPct > 8) {
    score += 10;
    reasons.push(`Today's dip on a long-term winner (+${plPct.toFixed(1)}% overall) — could be a good chance to add more`);
  }

  // Recovery signal: stock bouncing today from a loss position
  if (changePct > 1.5 && plPct < -5) {
    score += 8;
    reasons.push(`Stock is recovering today (+${changePct.toFixed(2)}%) despite being down overall — possible reversal signal`);
  }

  // Near break-even with upward momentum = early buy signal
  if (changePct > 0.5 && plPct >= -3 && plPct <= 5) {
    score += 5;
    reasons.push(`Price is near your buy cost with positive momentum — potential early breakout`);
  }

  // Already at big profit but still rallying = caution
  if (changePct > 2 && plPct > 20) {
    score -= 8;
    reasons.push(`Already at +${plPct.toFixed(1)}% profit and still rising — euphoria zone, book partial profits`);
  }

  // ── Map score to action ───────────────────────────────────────────────────
  score = Math.max(0, Math.min(100, score));

  let action;
  if (score >= 75)      action = 'STRONG_BUY';
  else if (score >= 60) action = 'BUY';
  else if (score >= 44) action = 'HOLD';
  else if (score >= 28) action = 'BOOK_PROFIT';
  else                  action = 'SELL';

  return {
    action,
    label:      actionLabel(action),
    color:      actionColor(action),
    reasons,
    confidence: score,
    plPct,
    changePct,
    weightPct,
    score, // expose for debugging
  };
}

/**
 * Generate suggestions for an entire holdings array.
 * All values are derived from real live price data and your portfolio data.
 */
export function generatePortfolioSuggestions(holdings, prices, fxRates, convertFn, inferFn) {
  if (!holdings?.length) return [];

  const totalValue = holdings.reduce((sum, h) => {
    const q        = prices[h.stock_symbol];
    const price    = q?.price ?? Number(h.average_buy_price);
    const currency = q?.currency || inferFn(h.stock_symbol, 'INR');
    return sum + convertFn(price * Number(h.quantity), currency, fxRates);
  }, 0);

  return holdings.map((h) => {
    const q        = prices[h.stock_symbol] || {};
    const price    = q.price ?? Number(h.average_buy_price);
    const currency = q.currency || inferFn(h.stock_symbol, 'INR');
    const value    = convertFn(price * Number(h.quantity), currency, fxRates);
    const weight   = totalValue > 0 ? value / totalValue : 0;

    return {
      ...h,
      suggestion: generateSuggestion(h, q, weight),
    };
  });
}
