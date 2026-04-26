/**
 * voiceParser.js — Natural Language Query Parser
 * Interprets spoken queries and answers from real portfolio data.
 * No AI API required — pure rule-based intent matching.
 */

function matchAny(text, patterns) {
  return patterns.some(p => text.includes(p));
}

function fmt(n) {
  return `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function noHoldings() {
  return {
    type: 'empty',
    title: '📭 No Holdings',
    answer: "You don't have any holdings yet. Add stocks to your portfolio first.",
    highlights: [],
  };
}

export function parseVoiceQuery(transcript, holdings, prices) {
  const t = transcript.toLowerCase().trim();

  if (!holdings?.length) return noHoldings();

  // Build enriched holdings with computed P&L
  const enriched = holdings.map(h => {
    const q        = prices?.[h.stock_symbol] || {};
    const curPrice = Number(q.price) || Number(h.average_buy_price);
    const avgBuy   = Number(h.average_buy_price);
    const qty      = Number(h.quantity);
    const invested = avgBuy * qty;
    const currentVal = curPrice * qty;
    const pl       = currentVal - invested;
    const plPct    = invested > 0 ? (pl / invested) * 100 : 0;
    const changePct = Number(q.changePct) || 0;
    const symbol   = h.stock_symbol.replace('.NS', '').replace('.BO', '');
    return { ...h, symbol, curPrice, avgBuy, qty, invested, currentVal, pl, plPct, changePct };
  });

  const totalValue    = enriched.reduce((s, h) => s + h.currentVal, 0);
  const totalInvested = enriched.reduce((s, h) => s + h.invested, 0);
  const totalPL       = totalValue - totalInvested;
  const totalPLPct    = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;

  // ── INTENTS ────────────────────────────────────────────────────────────────

  // Best performer (overall)
  if (matchAny(t, ['best perform', 'top perform', 'highest gain', 'most profit', 'biggest gain', 'best stock', 'top gainer', 'best performer'])) {
    const sorted = [...enriched].sort((a, b) => b.plPct - a.plPct);
    const top = sorted[0];
    return {
      type: 'best',
      title: '🏆 Best Performer',
      answer: `Your best performing stock is **${top.symbol}** with a gain of **+${top.plPct.toFixed(2)}%** (${fmt(top.pl)} profit). Bought at ₹${top.avgBuy.toFixed(2)}, now ₹${top.curPrice.toFixed(2)}.`,
      highlights: sorted.slice(0, 3).map(h => ({ symbol: h.symbol, value: `+${h.plPct.toFixed(2)}%`, positive: true })),
    };
  }

  // Worst performer (overall)
  if (matchAny(t, ['worst perform', 'biggest loss', 'most loss', 'worst stock', 'lowest perform', 'biggest loser', 'worst performer'])) {
    const sorted = [...enriched].sort((a, b) => a.plPct - b.plPct);
    const bot = sorted[0];
    const sign = bot.plPct >= 0 ? '+' : '';
    return {
      type: 'worst',
      title: '📉 Worst Performer',
      answer: `Your worst performing stock is **${bot.symbol}** with ${sign}${bot.plPct.toFixed(2)}% P&L (${fmt(Math.abs(bot.pl))} ${bot.pl < 0 ? 'loss' : 'profit'}). Bought at ₹${bot.avgBuy.toFixed(2)}, now ₹${bot.curPrice.toFixed(2)}.`,
      highlights: sorted.slice(0, 3).map(h => ({ symbol: h.symbol, value: `${h.plPct >= 0 ? '+' : ''}${h.plPct.toFixed(2)}%`, positive: h.plPct >= 0 })),
    };
  }

  // Today's best
  if (matchAny(t, ['today', "today's"]) && matchAny(t, ['best', 'top', 'up', 'gain', 'gainer', 'highest'])) {
    const sorted = [...enriched].sort((a, b) => b.changePct - a.changePct);
    const top = sorted[0];
    return {
      type: 'today_best',
      title: "📈 Today's Best",
      answer: `Today's best performer in your portfolio is **${top.symbol}** with **+${top.changePct.toFixed(2)}%** today.`,
      highlights: sorted.slice(0, 3).map(h => ({ symbol: h.symbol, value: `${h.changePct >= 0 ? '+' : ''}${h.changePct.toFixed(2)}%`, positive: h.changePct >= 0 })),
    };
  }

  // Today's worst
  if (matchAny(t, ['today', "today's"]) && matchAny(t, ['worst', 'bottom', 'down', 'fall', 'loser', 'lowest', 'loss'])) {
    const sorted = [...enriched].sort((a, b) => a.changePct - b.changePct);
    const bot = sorted[0];
    return {
      type: 'today_worst',
      title: "📉 Today's Worst",
      answer: `Today's biggest faller in your portfolio is **${bot.symbol}** with **${bot.changePct.toFixed(2)}%** today.`,
      highlights: sorted.slice(0, 3).map(h => ({ symbol: h.symbol, value: `${h.changePct.toFixed(2)}%`, positive: h.changePct >= 0 })),
    };
  }

  // Portfolio value / worth
  if (matchAny(t, ['portfolio value', 'portfolio worth', 'total value', 'total worth', 'how much is my portfolio', 'what is my portfolio worth', 'portfolio total'])) {
    return {
      type: 'value',
      title: '💼 Portfolio Value',
      answer: `Your portfolio is currently worth **${fmt(totalValue)}**. You invested ${fmt(totalInvested)} and your total ${totalPL >= 0 ? 'profit' : 'loss'} is **${fmt(totalPL)} (${totalPLPct >= 0 ? '+' : ''}${totalPLPct.toFixed(2)}%)**.`,
      highlights: [],
    };
  }

  // Total invested
  if (matchAny(t, ['how much invest', 'total invest', 'amount invest', 'how much put', 'total spent', 'money invest', 'total capital'])) {
    return {
      type: 'invested',
      title: '💰 Total Invested',
      answer: `You have invested **${fmt(totalInvested)}** across ${enriched.length} stocks. Current value: ${fmt(totalValue)} (${totalPLPct >= 0 ? '+' : ''}${totalPLPct.toFixed(2)}%).`,
      highlights: [],
    };
  }

  // Total P&L
  if (matchAny(t, ['total profit', 'total gain', 'total return', 'total loss', 'how much profit', 'how much gain', 'overall return', 'overall profit', 'total p&l'])) {
    return {
      type: 'pnl',
      title: `${totalPL >= 0 ? '✅' : '❌'} Total ${totalPL >= 0 ? 'Profit' : 'Loss'}`,
      answer: `Your total ${totalPL >= 0 ? 'profit' : 'loss'} is **${fmt(totalPL)} (${totalPLPct >= 0 ? '+' : ''}${totalPLPct.toFixed(2)}%)** on an investment of ${fmt(totalInvested)}.`,
      highlights: [],
    };
  }

  // Stocks in profit
  if (matchAny(t, ['stocks in profit', 'profitable stocks', 'green stocks', 'stocks up', 'which stocks profit', 'how many profit'])) {
    const profitStocks = enriched.filter(h => h.plPct >= 0).sort((a, b) => b.plPct - a.plPct);
    return {
      type: 'profit_stocks',
      title: `✅ ${profitStocks.length} Stocks in Profit`,
      answer: `You have **${profitStocks.length} stocks in profit** out of ${enriched.length} holdings.${profitStocks.length > 0 ? ` Top: ${profitStocks[0].symbol} (+${profitStocks[0].plPct.toFixed(1)}%)` : ''}`,
      highlights: profitStocks.slice(0, 5).map(h => ({ symbol: h.symbol, value: `+${h.plPct.toFixed(2)}%`, positive: true })),
    };
  }

  // Stocks in loss
  if (matchAny(t, ['stocks in loss', 'loss stocks', 'red stocks', 'stocks down', 'which stocks loss', 'how many loss'])) {
    const lossStocks = enriched.filter(h => h.plPct < 0).sort((a, b) => a.plPct - b.plPct);
    return {
      type: 'loss_stocks',
      title: `❌ ${lossStocks.length} Stocks in Loss`,
      answer: `You have **${lossStocks.length} stocks in loss** out of ${enriched.length} holdings.${lossStocks.length > 0 ? ` Worst: ${lossStocks[0].symbol} (${lossStocks[0].plPct.toFixed(1)}%)` : ''}`,
      highlights: lossStocks.slice(0, 5).map(h => ({ symbol: h.symbol, value: `${h.plPct.toFixed(2)}%`, positive: false })),
    };
  }

  // Biggest holding
  if (matchAny(t, ['biggest holding', 'largest holding', 'most valuable', 'highest value', 'largest position', 'biggest position'])) {
    const sorted = [...enriched].sort((a, b) => b.currentVal - a.currentVal);
    const top = sorted[0];
    return {
      type: 'biggest',
      title: '📊 Biggest Holding',
      answer: `Your biggest holding is **${top.symbol}** worth **${fmt(top.currentVal)}** (${((top.currentVal / totalValue) * 100).toFixed(1)}% of portfolio). You hold ${top.qty} shares.`,
      highlights: sorted.slice(0, 3).map(h => ({ symbol: h.symbol, value: fmt(h.currentVal), positive: true })),
    };
  }

  // How many stocks
  if (matchAny(t, ['how many stocks', 'number of stocks', 'how many holding', 'count stock', 'many stocks'])) {
    return {
      type: 'count',
      title: '📋 Holdings Count',
      answer: `You hold **${enriched.length} stocks** in your portfolio. Total value: ${fmt(totalValue)}.`,
      highlights: [],
    };
  }

  // Portfolio summary
  if (matchAny(t, ['summary', 'overview', 'portfolio summary', 'summarize', 'my portfolio', 'tell me about my portfolio', 'portfolio overview'])) {
    const profit = enriched.filter(h => h.plPct >= 0).length;
    return {
      type: 'summary',
      title: '📊 Portfolio Summary',
      answer: `You have **${enriched.length} stocks** worth **${fmt(totalValue)}**. Invested: ${fmt(totalInvested)}. Overall ${totalPL >= 0 ? 'profit' : 'loss'}: ${fmt(totalPL)} (${totalPLPct >= 0 ? '+' : ''}${totalPLPct.toFixed(2)}%). ${profit} stocks in profit, ${enriched.length - profit} in loss.`,
      highlights: [],
    };
  }

  // Specific stock lookup — check if query contains a known symbol
  const found = enriched.find(h => t.includes(h.symbol.toLowerCase()));
  if (found) {
    return {
      type: 'specific',
      title: `📈 ${found.symbol}`,
      answer: `**${found.symbol}**: ${found.qty} shares · Avg buy ₹${found.avgBuy.toFixed(2)} · Now ₹${found.curPrice.toFixed(2)} · P&L: ${found.plPct >= 0 ? '+' : ''}${found.plPct.toFixed(2)}% (${fmt(Math.abs(found.pl))} ${found.pl >= 0 ? 'profit' : 'loss'}) · Today: ${found.changePct >= 0 ? '+' : ''}${found.changePct.toFixed(2)}%`,
      highlights: [{ symbol: found.symbol, value: `${found.plPct >= 0 ? '+' : ''}${found.plPct.toFixed(2)}%`, positive: found.plPct >= 0 }],
    };
  }

  // Fallback
  return {
    type: 'unknown',
    title: '❓ Not Understood',
    answer: "I didn't understand that. Try asking something like: *\"Best performer\"*, *\"Portfolio value\"*, *\"Stocks in profit\"*, *\"Today's best\"*, or *\"Summary\"*.",
    highlights: [],
    suggestions: ['Best performer', 'Portfolio value', 'Stocks in profit', "Today's best", 'Summary'],
  };
}
