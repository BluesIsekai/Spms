import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PortfolioHealth from "../components/PortfolioHealth";
import RebalanceSuggestions from "../components/RebalanceSuggestions";
import RiskHeatmap from "../components/RiskHeatmap";
import SymbolLogo from "../components/ui/SymbolLogo";
import VoiceAssistant from "../components/VoiceAssistant";
import { useAuth } from "../hooks/useAuth.jsx";
import { useStockPolling } from "../hooks/useStockPolling";
import { fetchRecentViews, recordRecentView } from "../services/marketFeatureService";
import {
    fetchHoldings,
    fetchTransactions,
    fetchWatchlist,
    subscribeHoldings,
    subscribeTransactions,
    subscribeWatchlist,
} from "../services/portfolioService";
import { supabase } from "../services/supabaseClient";
import { fetchWallet, subscribeWallet } from "../services/walletService";
import { getFxRatesToINR, getHistoricalData, searchSymbols } from "../services/yahooStockApi";
import { generatePortfolioSuggestions } from "../utils/aiSuggestions";
import { convertToINR, inferCurrencyFromSymbol } from "../utils/currency";
import { getCompanyLogo } from "../utils/logos";
import "./Dashboard.css";

const DEFAULT_BALANCE = 100000;

// Popular Indian Stocks as a fallback to form the "Explore" Grid
const DEFAULT_WATCHLIST = [
    { stock_symbol: "RELIANCE.NS", company_name: "Reliance Industries" },
    { stock_symbol: "TCS.NS", company_name: "Tata Consultancy Services" },
    { stock_symbol: "HDFCBANK.NS", company_name: "HDFC Bank" },
    { stock_symbol: "ICICIBANK.NS", company_name: "ICICI Bank" },
    { stock_symbol: "INFY.NS", company_name: "Infosys" },
    { stock_symbol: "SBIN.NS", company_name: "State Bank of India" },
];

// Market indices (Added Bank Nifty)
const INDEX_SYMBOLS = [
    "^NSEI",
    "^BSESN",
    "^NSEBANK",
    "^DJI",
    "YM=F",
    "GIFTNIFTY.NS",
    "^IXIC",
    "^GSPC",
    "^N225",
    "^HSI",
    "^GDAXI",
    "^FCHI",
    "^KS11",
    "^FTSE",
];

const SUPABASE_CONFIGURED = !!supabase;

function timeAgo(dateStr) {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return "just now";
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function StockGrid({ stocks, type = "normal", idPrefix = "", openChart }) {
    if (!stocks || stocks.length === 0) return <div className="gd-empty">No data available</div>;
    const gridClass =
        type === "small" ? "gd-stock-grid-small" : type === "horizontal" ? "gd-stock-grid-horizontal" : "";
    return (
        <div className={`gd-stock-grid ${gridClass}`}>
            {stocks.map(stock => {
                const isUp = stock.changePct >= 0;
                return (
                    <button
                        key={`${idPrefix}-${stock.symbol}`}
                        className={`gd-stock-card ${type === "small" ? "small" : type === "horizontal" ? "horizontal" : ""}`}
                        onClick={() => openChart(stock.symbol)}
                    >
                        <div className="gd-stock-icon" style={{ padding: 0, overflow: "hidden", background: "#fff" }}>
                            <img
                                src={
                                    getCompanyLogo(stock.symbol) ||
                                    `https://ui-avatars.com/api/?name=${encodeURIComponent(stock.symbol.replace(/=F|\.NS|\.BO|-USD/g, ""))}&background=232836&color=fff&size=64`
                                }
                                alt={stock.symbol}
                                style={{ width: "100%", height: "100%", objectFit: "contain" }}
                                onError={e => {
                                    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(stock.symbol.replace(/=F|\.NS|\.BO|-USD/g, ""))}&background=232836&color=fff&size=64`;
                                }}
                            />
                        </div>
                        <div className="gd-stock-name">{stock.name}</div>
                        <div className="gd-stock-price-row">
                            <span className="gd-card-price">
                                {stock.price > 0 ? `₹${stock.price.toFixed(2)}` : "—"}
                            </span>
                        </div>
                        <div className="gd-stock-change-row">
                            <span className={`gd-card-change ${isUp ? "up" : "down"}`}>
                                {isUp ? "+" : ""}
                                {stock.change.toFixed(2)} ({isUp ? "+" : ""}
                                {stock.changePct.toFixed(2)}%)
                            </span>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}

export default function Dashboard({ appPrices = {}, lastUpdated, connected, onRefresh }) {
    const { user } = useAuth();
    const navigate = useNavigate();

    // Tabs state
    const [activeTab, setActiveTab] = useState("Explore"); // 'Explore', 'Holdings', 'Positions', 'Orders', 'Watchlists'
    const [orderSubTab, setOrderSubTab] = useState("All"); // 'All', 'Completed', 'Pending', 'Cancelled'
    const [topMoversTab, setTopMoversTab] = useState("Gainers"); // 'Gainers', 'Losers'
    const [holdingsSubTab, setHoldingsSubTab] = useState("list"); // 'list' | 'ai' | 'heatmap'

    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    // Debounced symbol search
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }
        const timer = setTimeout(() => {
            setIsSearching(true);
            searchSymbols(searchQuery)
                .then(res => setSearchResults(res || []))
                .catch(() => setSearchResults([]))
                .finally(() => setIsSearching(false));
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const [isBalanceHidden, setIsBalanceHidden] = useState(false);

    const [holdings, setHoldings] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [wallet, setWallet] = useState(null);
    const [watchlistItems, setWatchlistItems] = useState([]);
    const [fxRates, setFxRates] = useState({});
    const [prevCloseBySymbol, setPrevCloseBySymbol] = useState({});
    const [recentViewRows, setRecentViewRows] = useState([]);

    // ── Data loading ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (!user?.id) return;

        if (!SUPABASE_CONFIGURED) {
            setHoldings([
                { stock_symbol: "RELIANCE.NS", quantity: 10, average_buy_price: 2800 },
                { stock_symbol: "TCS.NS", quantity: 5, average_buy_price: 3600 },
                { stock_symbol: "INFY.NS", quantity: 15, average_buy_price: 1500 },
            ]);
            setTransactions([
                {
                    id: 1,
                    stock_symbol: "RELIANCE.NS",
                    transaction_type: "BUY",
                    quantity: 10,
                    price: 2800,
                    status: "COMPLETED",
                    total_amount: 28000,
                    created_at: new Date(Date.now() - 7200000).toISOString(),
                },
                {
                    id: 2,
                    stock_symbol: "TCS.NS",
                    transaction_type: "BUY",
                    quantity: 5,
                    price: 3600,
                    status: "COMPLETED",
                    total_amount: 18000,
                    created_at: new Date(Date.now() - 86400000).toISOString(),
                },
            ]);
            setWallet({ virtual_balance: DEFAULT_BALANCE });
            setWatchlistItems(DEFAULT_WATCHLIST);
            return;
        }

        Promise.all([
            fetchHoldings(user.id),
            fetchTransactions(user.id, 50), // Fetch more for the orders tab
            fetchWallet(user.id),
            fetchWatchlist(user.id),
        ])
            .then(([h, t, w, wl]) => {
                setHoldings(h || []);
                setTransactions(t || []);
                setWallet(w || null);
                setWatchlistItems(wl?.length ? wl : DEFAULT_WATCHLIST);
            })
            .catch(() => {});

        const unsub1 = subscribeHoldings(user.id, () =>
            fetchHoldings(user.id)
                .then(setHoldings)
                .catch(() => {}),
        );
        const unsub2 = subscribeTransactions(user.id, () =>
            fetchTransactions(user.id, 50)
                .then(setTransactions)
                .catch(() => {}),
        );
        const unsub3 = subscribeWallet(user.id, () =>
            fetchWallet(user.id)
                .then(setWallet)
                .catch(() => {}),
        );
        const unsub4 = subscribeWatchlist(user.id, () =>
            fetchWatchlist(user.id)
                .then(wl => setWatchlistItems(wl?.length ? wl : DEFAULT_WATCHLIST))
                .catch(() => {}),
        );
        return () => {
            unsub1();
            unsub2();
            unsub3();
            unsub4();
        };
    }, [user?.id]);

    useEffect(() => {
        if (!user?.id || !SUPABASE_CONFIGURED) {
            setRecentViewRows([]);
            return;
        }

        fetchRecentViews(user.id, {
            limit: 7,
            assetTypes: ["EQUITY", "ETF", "INDEX", "FNO", "COMMODITY", "CRYPTO"],
        })
            .then(rows => {
                const arr = rows || [];
                try {
                    console.debug("fetchRecentViews -> rows", arr);
                } catch (e) {}

                // sort by last_viewed_at desc to ensure newest first
                const sorted = arr.slice().sort((a, b) => {
                    const ta = a?.last_viewed_at ? new Date(a.last_viewed_at).getTime() : 0;
                    const tb = b?.last_viewed_at ? new Date(b.last_viewed_at).getTime() : 0;
                    return tb - ta;
                });

                // dedupe by yahoo_symbol (keep first = most recent)
                const seen = new Set();
                const dedup = [];
                for (const r of sorted) {
                    const key = (r?.yahoo_symbol || r?.symbol || "").toString();
                    if (!key) continue;
                    if (!seen.has(key)) {
                        dedup.push(r);
                        seen.add(key);
                    }
                }

                setRecentViewRows(dedup.slice(0, 7));
            })
            .catch(() => setRecentViewRows([]));
    }, [user?.id]);

    // ── Stock price polling ───────────────────────────────────────────────────
    const watchlistSymbols = useMemo(
        () => watchlistItems.map(w => w.stock_symbol || w.yahoo_symbol).filter(Boolean),
        [watchlistItems],
    );
    const heldSymbols = useMemo(() => holdings.map(h => h.stock_symbol), [holdings]);
    const defaultSymbols = DEFAULT_WATCHLIST.map(w => w.stock_symbol);

    const allPolled = useMemo(
        () => [...new Set([...watchlistSymbols, ...heldSymbols, ...defaultSymbols, ...INDEX_SYMBOLS])],
        [watchlistSymbols.join(), heldSymbols.join()],
    );

    const { prices: dashPrices } = useStockPolling(allPolled, 10_000);
    const mergedPrices = useMemo(() => ({ ...dashPrices, ...appPrices }), [dashPrices, appPrices]);

    // FX rates
    useEffect(() => {
        const currencies = holdings
            .map(h => mergedPrices[h.stock_symbol]?.currency || inferCurrencyFromSymbol(h.stock_symbol, "USD"))
            .filter(Boolean);
        getFxRatesToINR(currencies)
            .then(r => setFxRates(r || {}))
            .catch(() => {});
    }, [holdings, mergedPrices]);

    // Prev close fallback (for holdings P/L calculation if quote prevClose is missing)
    useEffect(() => {
        let cancelled = false;
        const targets = holdings
            .map(h => h.stock_symbol)
            .filter(sym => {
                const q = mergedPrices[sym];
                return !(q && Number.isFinite(Number(q.prevClose)) && Number(q.prevClose) > 0);
            });
        if (!targets.length)
            return () => {
                cancelled = true;
            };

        (async () => {
            const entries = await Promise.all(
                [...new Set(targets)].map(async sym => {
                    try {
                        const { candles = [] } = await getHistoricalData(sym, "5D");
                        const closes = candles.map(c => Number(c?.close)).filter(n => Number.isFinite(n) && n > 0);
                        if (!closes.length) return [sym, undefined];
                        return [sym, closes.length > 1 ? closes[closes.length - 2] : closes[0]];
                    } catch {
                        return [sym, undefined];
                    }
                }),
            );
            if (!cancelled) {
                setPrevCloseBySymbol(Object.fromEntries(entries.filter(([, v]) => Number.isFinite(v) && v > 0)));
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [holdings, mergedPrices]);

    // ── Derived metrics ───────────────────────────────────────────────────────
    const portfolioMetrics = useMemo(() => {
        const portfolioValue = holdings.reduce((sum, h) => {
            const p = mergedPrices[h.stock_symbol]?.price ?? Number(h.average_buy_price);
            const currency = mergedPrices[h.stock_symbol]?.currency || inferCurrencyFromSymbol(h.stock_symbol, "USD");
            return sum + convertToINR(p * Number(h.quantity), currency, fxRates);
        }, 0);

        const invested = holdings.reduce((sum, h) => {
            const currency = mergedPrices[h.stock_symbol]?.currency || inferCurrencyFromSymbol(h.stock_symbol, "USD");
            return sum + convertToINR(Number(h.average_buy_price) * Number(h.quantity), currency, fxRates);
        }, 0);

        const previousCloseValue = holdings.reduce((sum, h) => {
            const quote = mergedPrices[h.stock_symbol];
            const current = quote?.price ?? Number(h.average_buy_price);
            const previous =
                (Number.isFinite(Number(quote?.prevClose)) && Number(quote?.prevClose) > 0
                    ? Number(quote.prevClose)
                    : undefined) ??
                prevCloseBySymbol[h.stock_symbol] ??
                (quote ? current - (quote.change ?? 0) : Number(h.average_buy_price));
            const currency = quote?.currency || inferCurrencyFromSymbol(h.stock_symbol, "USD");
            return sum + convertToINR(previous * Number(h.quantity), currency, fxRates);
        }, 0);

        const totalPnL = portfolioValue - invested;
        const totalPnLPct = invested > 0 ? (totalPnL / invested) * 100 : 0;
        const todayPnL = portfolioValue - previousCloseValue;
        const todayPnLPct = previousCloseValue > 0 ? (todayPnL / previousCloseValue) * 100 : 0;

        return { portfolioValue, invested, totalPnL, totalPnLPct, todayPnL, todayPnLPct };
    }, [holdings, mergedPrices, fxRates, prevCloseBySymbol]);

    // Use either actual watchlist or default for explore grid
    const exploreStocks = useMemo(() => {
        const source = watchlistItems.length > 0 ? watchlistItems : DEFAULT_WATCHLIST;
        return source.map(item => {
            const sym = item.stock_symbol || item.yahoo_symbol;
            const q = mergedPrices[sym] || {};
            return {
                symbol: sym,
                name: item.company_name || sym.replace(".NS", ""),
                price: q.price || 0,
                change: q.change || 0,
                changePct: q.changePct || 0,
                currency: q.currency || "INR",
            };
        });
    }, [watchlistItems, mergedPrices]);

    const baseExtended = useMemo(() => {
        // Build a prioritized, deduplicated list of symbols from user data
        const recentSymbols = (recentViewRows || []).map(r => r.yahoo_symbol || r.symbol).filter(Boolean);
        const holdingSymbols = (holdings || []).map(h => h.stock_symbol).filter(Boolean);
        const watchSymbols = (watchlistItems || []).map(w => w.stock_symbol || w.yahoo_symbol).filter(Boolean);
        const defaultSymbols = DEFAULT_WATCHLIST.map(w => w.stock_symbol).filter(Boolean);

        const combined = [...recentSymbols, ...holdingSymbols, ...watchSymbols, ...defaultSymbols];

        const seen = new Set();
        const unique = [];
        for (const s of combined) {
            if (!seen.has(s)) {
                seen.add(s);
                unique.push(s);
            }
        }

        return unique.map(sym => {
            const q = mergedPrices[sym] || {};
            // find a friendly name from available data sources
            const recentRow = (recentViewRows || []).find(r => (r.yahoo_symbol || r.symbol) === sym);
            const watchItem = (watchlistItems || []).find(w => (w.stock_symbol || w.yahoo_symbol) === sym);
            const holding = (holdings || []).find(h => h.stock_symbol === sym);
            const name =
                (recentRow && (recentRow.company_name || null)) ||
                (watchItem && (watchItem.company_name || null)) ||
                (holding && (holding.company_name || null)) ||
                sym.replace(".NS", "").replace("^", "");
            return {
                symbol: sym,
                name,
                price: q.price || 0,
                change: q.change || 0,
                changePct: q.changePct || 0,
                currency: q.currency || "INR",
            };
        });
    }, [recentViewRows, holdings, watchlistItems, mergedPrices]);

    const getSlice = start => {
        return baseExtended.slice(start, start + 5);
    };

    const topGainers = useMemo(() => {
        return [...baseExtended].sort((a, b) => b.changePct - a.changePct).filter(s => s.changePct > 0);
    }, [baseExtended]);

    const topLosers = useMemo(() => {
        return [...baseExtended].sort((a, b) => a.changePct - b.changePct).filter(s => s.changePct < 0);
    }, [baseExtended]);

    const topGainersSlice = useMemo(() => topGainers.slice(0, 5), [topGainers]);
    const topLosersSlice = useMemo(() => topLosers.slice(0, 5), [topLosers]);

    const recentlyViewed = useMemo(() => {
        if (!recentViewRows.length) return baseExtended.slice(0, 7);

        const chartableRows = recentViewRows.filter(row => row.asset_type !== "MUTUAL_FUND");
        if (!chartableRows.length) return baseExtended.slice(0, 7);

        return chartableRows.map(row => {
            const symbol = row.yahoo_symbol || row.symbol;
            const quote = mergedPrices[symbol] || {};
            return {
                symbol,
                name: row.company_name || symbol.replace(".NS", "").replace("^", ""),
                price: quote.price || 0,
                change: quote.change || 0,
                changePct: quote.changePct || 0,
                currency: quote.currency || "INR",
            };
        });
    }, [recentViewRows, baseExtended, mergedPrices]);
    const mostBought = useMemo(() => getSlice(3), [baseExtended]);
    const mostTradedMtf = useMemo(() => getSlice(1), [baseExtended]);
    const topIntraday = useMemo(() => getSlice(2), [baseExtended]);
    const volumeShockers = useMemo(() => getSlice(0), [baseExtended]);
    const sectorsTrending = useMemo(() => getSlice(5), [baseExtended]);
    const mostBoughtEtfs = useMemo(() => getSlice(4), [baseExtended]);

    // Orders filtering
    const filteredOrders = useMemo(() => {
        if (orderSubTab === "All") return transactions;
        if (orderSubTab === "Completed") return transactions; // DB currently only stores completed ones
        return []; // Pending / Cancelled will be empty
    }, [transactions, orderSubTab]);

    // Market indices
    const indices = [
        { label: "NIFTY 50", symbol: "^NSEI", data: mergedPrices["^NSEI"] },
        { label: "SENSEX", symbol: "^BSESN", data: mergedPrices["^BSESN"] },
        { label: "BANK NIFTY", symbol: "^NSEBANK", data: mergedPrices["^NSEBANK"] },
    ];

    const globalIndices = [
        { label: "GIFT Nifty", symbol: "GIFTNIFTY.NS", data: mergedPrices["GIFTNIFTY.NS"] },
        { label: "Dow Jones", symbol: "^DJI", data: mergedPrices["^DJI"] },
        { label: "Dow Futures", symbol: "YM=F", data: mergedPrices["YM=F"] },
        { label: "S&P 500", symbol: "^GSPC", data: mergedPrices["^GSPC"] },
        { label: "NASDAQ", symbol: "^IXIC", data: mergedPrices["^IXIC"] },
        { label: "Nikkei 225", symbol: "^N225", data: mergedPrices["^N225"] },
        { label: "Hang Seng", symbol: "^HSI", data: mergedPrices["^HSI"] },
        { label: "DAX", symbol: "^GDAXI", data: mergedPrices["^GDAXI"] },
        { label: "CAC 40", symbol: "^FCHI", data: mergedPrices["^FCHI"] },
        { label: "KOSPI", symbol: "^KS11", data: mergedPrices["^KS11"] },
        { label: "FTSE 100", symbol: "^FTSE", data: mergedPrices["^FTSE"] },
    ];

    const openChart = symbol => {
        void recordRecentView(user?.id, symbol, {
            companyName: symbol.replace(".NS", "").replace("^", ""),
            sourcePage: "dashboard",
        });
        navigate(`/chart/${encodeURIComponent(symbol)}`);
    };

    return (
        <div className="groww-dashboard">
            {/* ── TOP BAR ── */}
            <header className="gd-topbar">
                <div className="gd-indices-scroll">
                    {indices.map(idx => {
                        const price = idx.data?.price;
                        const changePct = idx.data?.changePct || 0;
                        const change = idx.data?.change || 0;
                        const isUp = changePct >= 0;
                        return (
                            <div
                                key={idx.label}
                                className="gd-index-card"
                                onClick={() => navigate(`/chart/${encodeURIComponent(idx.symbol)}`)}
                                style={{ cursor: "pointer" }}
                            >
                                <span className="gd-index-name">{idx.label}</span>
                                <div className="gd-index-values">
                                    <span className="gd-index-price">
                                        {price ? price.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"}
                                    </span>
                                    {idx.data && (
                                        <span className={`gd-index-change ${isUp ? "up" : "down"}`}>
                                            {isUp ? "+" : ""}
                                            {change.toFixed(2)} ({isUp ? "+" : ""}
                                            {changePct.toFixed(2)}%)
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    <div
                        className="gd-index-card gd-global-trigger"
                        onClick={() => navigate("/global-indices")}
                        style={{ cursor: "pointer" }}
                    >
                        <span className="gd-index-name" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            Global Indices
                            <span style={{ fontSize: 9, opacity: 0.6 }}>▾</span>
                        </span>
                        <span className="gd-index-price" style={{ color: "#666", fontSize: 11 }}>
                            11 markets
                        </span>
                    </div>
                </div>

                <div className="gd-topbar-actions">
                    <div className="gd-search-container">
                        <svg
                            width="16"
                            height="16"
                            fill="none"
                            stroke="#555"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            style={{ flexShrink: 0 }}
                        >
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                            type="text"
                            className="gd-search-input"
                            placeholder="Search stocks, ETFs, indices…"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        {searchQuery.trim().length > 0 && (
                            <button
                                className="gd-icon-btn"
                                style={{ padding: 0 }}
                                onClick={() => {
                                    setSearchQuery("");
                                    setSearchResults([]);
                                }}
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <path d="M18 6L6 18M6 6l12 12" />
                                </svg>
                            </button>
                        )}

                        {searchQuery.trim().length > 0 && (
                            <div
                                className="gd-search-dropdown"
                                style={{
                                    position: "absolute",
                                    top: "100%",
                                    left: 0,
                                    right: 0,
                                    background: "#1a1a1a",
                                    border: "1px solid #2e2e2e",
                                    borderRadius: "12px",
                                    marginTop: "6px",
                                    zIndex: 1000,
                                    maxHeight: "460px",
                                    overflowY: "auto",
                                    boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
                                }}
                            >
                                {isSearching ? (
                                    <div
                                        style={{
                                            padding: "20px",
                                            color: "#666",
                                            fontSize: "13px",
                                            textAlign: "center",
                                        }}
                                    >
                                        Searching market…
                                    </div>
                                ) : searchResults.length > 0 ? (
                                    searchResults.map(res => (
                                        <div
                                            key={res.symbol}
                                            style={{
                                                padding: "14px 20px",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "16px",
                                                cursor: "pointer",
                                                borderBottom: "1px solid #232323",
                                                transition: "background 0.15s",
                                            }}
                                            onClick={() => {
                                                setSearchQuery("");
                                                setSearchResults([]);
                                                openChart(res.symbol);
                                            }}
                                            onMouseEnter={e => (e.currentTarget.style.background = "#242424")}
                                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                                        >
                                            {/* Logo — bigger, fixed size, no shrink */}
                                            <div
                                                style={{
                                                    flexShrink: 0,
                                                    width: 44,
                                                    height: 44,
                                                    borderRadius: 8,
                                                    overflow: "hidden",
                                                    background: "#fff",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                }}
                                            >
                                                <SymbolLogo symbol={res.symbol} size={44} />
                                            </div>
                                            {/* Name + meta */}
                                            <div
                                                style={{
                                                    flex: 1,
                                                    minWidth: 0,
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    gap: 3,
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        fontSize: "15px",
                                                        fontWeight: 600,
                                                        color: "#fff",
                                                        whiteSpace: "nowrap",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                    }}
                                                >
                                                    {res.shortname || res.longname || res.symbol}
                                                </span>
                                                <span style={{ fontSize: "12px", color: "#666" }}>
                                                    {res.symbol} &nbsp;·&nbsp; {res.exchDisp || res.exchange}{" "}
                                                    &nbsp;·&nbsp; <span style={{ color: "#444" }}>{res.quoteType}</span>
                                                </span>
                                            </div>
                                            {/* Arrow hint */}
                                            <svg
                                                style={{ flexShrink: 0, color: "#444" }}
                                                width="14"
                                                height="14"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                            >
                                                <polyline points="9 18 15 12 9 6" />
                                            </svg>
                                        </div>
                                    ))
                                ) : (
                                    <div
                                        style={{
                                            padding: "20px",
                                            color: "#555",
                                            fontSize: "13px",
                                            textAlign: "center",
                                        }}
                                    >
                                        No symbols found
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <button
                        className="gd-icon-btn gd-profile-btn"
                        onClick={() => navigate("/settings")}
                        title="Profile"
                    >
                        <svg
                            width="20"
                            height="20"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                        >
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                    </button>
                </div>
            </header>

            {/* ── TABS NAVIGATION ── */}
            <nav className="gd-tabs-nav">
                {["Explore", "Holdings", "Positions", "Orders"].map(tab => (
                    <button
                        key={tab}
                        className={`gd-tab ${activeTab === tab ? "active" : ""}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {tab}
                    </button>
                ))}
                <button className="gd-tab" onClick={() => navigate("/watchlist")} title="Open Watchlist page">
                    Watchlists
                </button>
            </nav>

            <main className="gd-content">
                {/* ════════ EXPLORE TAB ════════ */}
                {activeTab === "Explore" && (
                    <div className="gd-tab-panel">
                        <div className="gd-explore-vertical">
                            {/* Recently Viewed */}
                            <section className="gd-explore-section">
                                <h2 className="gd-section-title">Recently Viewed</h2>
                                <StockGrid
                                    stocks={recentlyViewed}
                                    type="horizontal"
                                    idPrefix="rv"
                                    openChart={openChart}
                                />
                            </section>

                            {/* Most Bought */}
                            <section className="gd-explore-section">
                                <div className="gd-section-header-split">
                                    <h2 className="gd-section-title">Most Bought</h2>
                                    <button
                                        className="gd-see-more-btn"
                                        onClick={() => navigate("/explore/most-bought")}
                                    >
                                        See More
                                    </button>
                                </div>
                                <StockGrid stocks={mostBought} idPrefix="mb" openChart={openChart} />
                            </section>

                            {/* Top Movers Today */}
                            <section className="gd-explore-section">
                                <div className="gd-section-header-split">
                                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                                        <h2 className="gd-section-title">Top Movers Today</h2>
                                        <div className="gd-inline-tabs">
                                            <button
                                                className={topMoversTab === "Gainers" ? "active" : ""}
                                                onClick={() => setTopMoversTab("Gainers")}
                                            >
                                                Gainers
                                            </button>
                                            <button
                                                className={topMoversTab === "Losers" ? "active" : ""}
                                                onClick={() => setTopMoversTab("Losers")}
                                            >
                                                Losers
                                            </button>
                                        </div>
                                    </div>
                                    <button className="gd-see-more-btn" onClick={() => navigate("/explore/top-movers")}>
                                        See More
                                    </button>
                                </div>
                                <StockGrid
                                    stocks={topMoversTab === "Gainers" ? topGainersSlice : topLosersSlice}
                                    idPrefix="tm"
                                    openChart={openChart}
                                />
                            </section>

                            {/* Most Traded in MTF */}
                            <section className="gd-explore-section">
                                <div className="gd-section-header-split">
                                    <h2 className="gd-section-title">Most Traded in MTF</h2>
                                    <button
                                        className="gd-see-more-btn"
                                        onClick={() => navigate("/explore/most-traded-mtf")}
                                    >
                                        See More
                                    </button>
                                </div>
                                <StockGrid stocks={mostTradedMtf} idPrefix="mtf" openChart={openChart} />
                            </section>

                            {/* Top Intraday */}
                            <section className="gd-explore-section">
                                <div className="gd-section-header-split">
                                    <h2 className="gd-section-title">Top Intraday</h2>
                                    <button
                                        className="gd-see-more-btn"
                                        onClick={() => navigate("/explore/top-intraday")}
                                    >
                                        See More
                                    </button>
                                </div>
                                <StockGrid stocks={topIntraday} idPrefix="ti" openChart={openChart} />
                            </section>

                            {/* Volume Shockers */}
                            <section className="gd-explore-section">
                                <div className="gd-section-header-split">
                                    <h2 className="gd-section-title">Volume Shockers</h2>
                                    <button
                                        className="gd-see-more-btn"
                                        onClick={() => navigate("/explore/volume-shockers")}
                                    >
                                        See More
                                    </button>
                                </div>
                                <StockGrid stocks={volumeShockers} idPrefix="vs" openChart={openChart} />
                            </section>

                            {/* Sectors Trending Today */}
                            <section className="gd-explore-section">
                                <div className="gd-section-header-split">
                                    <h2 className="gd-section-title">Sectors Trending Today</h2>
                                    <button
                                        className="gd-see-more-btn"
                                        onClick={() => navigate("/explore/sectors-trending")}
                                    >
                                        See More
                                    </button>
                                </div>
                                <StockGrid stocks={sectorsTrending} idPrefix="st" openChart={openChart} />
                            </section>

                            {/* Most Bought ETFs */}
                            <section className="gd-explore-section">
                                <div className="gd-section-header-split">
                                    <h2 className="gd-section-title">Most Bought ETFs</h2>
                                    <button
                                        className="gd-see-more-btn"
                                        onClick={() => navigate("/explore/most-bought-etfs")}
                                    >
                                        See More
                                    </button>
                                </div>
                                <StockGrid stocks={mostBoughtEtfs} idPrefix="mbetf" openChart={openChart} />
                            </section>
                        </div>
                    </div>
                )}

                {/* ════════ HOLDINGS TAB ════════ */}
                {activeTab === "Holdings" && (
                    <div className="gd-tab-panel">
                        {/* Portfolio Overview */}
                        <div className="gd-portfolio-card-v2">
                            <div className="gd-pc-top">
                                <div className="gd-pc-current-value">
                                    Current Value
                                    <span className="gd-pc-big-val">
                                        {isBalanceHidden
                                            ? "••••••"
                                            : `₹${portfolioMetrics.portfolioValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
                                    </span>
                                </div>
                                <button
                                    className="gd-eye-btn"
                                    onClick={() => setIsBalanceHidden(!isBalanceHidden)}
                                    title={isBalanceHidden ? "Show balances" : "Hide balances"}
                                >
                                    {isBalanceHidden ? (
                                        <svg
                                            width="24"
                                            height="24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            viewBox="0 0 24 24"
                                        >
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" />
                                        </svg>
                                    ) : (
                                        <svg
                                            width="24"
                                            height="24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            viewBox="0 0 24 24"
                                        >
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                            <circle cx="12" cy="12" r="3" />
                                        </svg>
                                    )}
                                </button>
                            </div>

                            <div className="gd-pc-metrics">
                                <div className="gd-pc-metric-row">
                                    <span className="gd-pc-label">1D returns</span>
                                    <span className={`gd-pc-val ${portfolioMetrics.todayPnL >= 0 ? "up" : "down"}`}>
                                        {isBalanceHidden ? (
                                            "••••••"
                                        ) : (
                                            <>
                                                {portfolioMetrics.todayPnL >= 0 ? "+" : "−"}₹
                                                {Math.abs(portfolioMetrics.todayPnL).toLocaleString("en-IN", {
                                                    maximumFractionDigits: 0,
                                                })}{" "}
                                                ({portfolioMetrics.todayPnL >= 0 ? "+" : "−"}
                                                {Math.abs(portfolioMetrics.todayPnLPct).toFixed(2)}%)
                                            </>
                                        )}
                                    </span>
                                </div>
                                <div className="gd-pc-metric-row">
                                    <span className="gd-pc-label">Total returns</span>
                                    <span className={`gd-pc-val ${portfolioMetrics.totalPnL >= 0 ? "up" : "down"}`}>
                                        {isBalanceHidden ? (
                                            "••••••"
                                        ) : (
                                            <>
                                                {portfolioMetrics.totalPnL >= 0 ? "+" : "−"}₹
                                                {Math.abs(portfolioMetrics.totalPnL).toLocaleString("en-IN", {
                                                    maximumFractionDigits: 0,
                                                })}{" "}
                                                ({portfolioMetrics.totalPnL >= 0 ? "+" : "−"}
                                                {Math.abs(portfolioMetrics.totalPnLPct).toFixed(2)}%)
                                            </>
                                        )}
                                    </span>
                                </div>
                                <div className="gd-pc-metric-row" style={{ borderBottom: "none" }}>
                                    <span className="gd-pc-label">Invested</span>
                                    <span className="gd-pc-val standard">
                                        {isBalanceHidden
                                            ? "••••••"
                                            : `₹${portfolioMetrics.invested.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
                                    </span>
                                </div>
                            </div>
                        </div>
                        {/* ── Portfolio Health Banner ── */}
                        {holdings.length > 0 && <PortfolioHealth holdings={holdings} prices={mergedPrices} />}

                        {/* ── Holdings Sub-Tabs ── */}
                        <div className="gd-subtabs" style={{ marginBottom: "20px" }}>
                            {[
                                { id: "list", label: "📋 Holdings" },
                                { id: "ai", label: "🤖 AI Insights" },
                                { id: "heatmap", label: "🌡️ Risk Heatmap" },
                                { id: "rebalance", label: "⚖️ Rebalance" },
                            ].map(t => (
                                <button
                                    key={t.id}
                                    id={`holdings-subtab-${t.id}`}
                                    className={`gd-subtab ${holdingsSubTab === t.id ? "active" : ""}`}
                                    onClick={() => setHoldingsSubTab(t.id)}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>

                        {/* ── Holdings List ── */}
                        {holdingsSubTab === "list" && (
                            <div className="gd-list-container">
                                {holdings.length === 0 ? (
                                    <div className="gd-empty">No delivery holdings yet. Start investing!</div>
                                ) : (
                                    <>
                                        <div className="gd-hr-header">
                                            <div className="gd-hr-col flex-2 left">Stock Name</div>
                                            <div className="gd-hr-col right">Market Price (1D%)</div>
                                            <div className="gd-hr-col right">Returns (%)</div>
                                            <div className="gd-hr-col right">Current (Invested)</div>
                                        </div>
                                        {holdings.map(h => {
                                            const quote = mergedPrices[h.stock_symbol];
                                            const currentPrice = quote?.price ?? Number(h.average_buy_price);
                                            const invested = Number(h.quantity) * Number(h.average_buy_price);
                                            const currentVal = Number(h.quantity) * currentPrice;
                                            const pl = currentVal - invested;
                                            const plPct = invested > 0 ? (pl / invested) * 100 : 0;
                                            const isUp = pl >= 0;
                                            const todayPct = quote?.changePct || 0;
                                            const isDayUp = todayPct >= 0;
                                            return (
                                                <button
                                                    key={h.stock_symbol}
                                                    className="gd-holdings-row"
                                                    onClick={() => openChart(h.stock_symbol)}
                                                >
                                                    <div className="gd-hr-col flex-2 left">
                                                        <span className="gd-hr-title">
                                                            {h.stock_symbol.replace(".NS", "")}
                                                        </span>
                                                        <span className="gd-hr-subtitle">{h.quantity} shares</span>
                                                    </div>
                                                    <div className="gd-hr-col right">
                                                        <span className="gd-hr-val">
                                                            {isBalanceHidden ? "••••••" : `₹${currentPrice.toFixed(2)}`}
                                                        </span>
                                                        <span className={`gd-hr-sub ${isDayUp ? "up" : "down"}`}>
                                                            {isBalanceHidden
                                                                ? "••••••"
                                                                : `(${isDayUp ? "+" : "−"}${Math.abs(todayPct).toFixed(2)}%)`}
                                                        </span>
                                                    </div>
                                                    <div className="gd-hr-col right">
                                                        <span className={`gd-hr-val ${isUp ? "up" : "down"}`}>
                                                            {isBalanceHidden
                                                                ? "••••••"
                                                                : `${isUp ? "+" : "−"}${Math.abs(plPct).toFixed(2)}%`}
                                                        </span>
                                                        <span className={`gd-hr-sub ${isUp ? "up" : "down"}`}>
                                                            {isBalanceHidden
                                                                ? "••••••"
                                                                : `${isUp ? "+" : "−"}₹${Math.abs(pl).toFixed(2)}`}
                                                        </span>
                                                    </div>
                                                    <div className="gd-hr-col right">
                                                        <span className="gd-hr-val current">
                                                            {isBalanceHidden
                                                                ? "••••••"
                                                                : `₹${currentVal.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
                                                        </span>
                                                        <span className="gd-hr-sub invested">
                                                            {isBalanceHidden
                                                                ? "••••••"
                                                                : `(₹${invested.toLocaleString("en-IN", { maximumFractionDigits: 0 })})`}
                                                        </span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </>
                                )}
                            </div>
                        )}

                        {/* ── AI Suggestions ── */}
                        {holdingsSubTab === "ai" &&
                            (() => {
                                const suggestions = generatePortfolioSuggestions(
                                    holdings,
                                    mergedPrices,
                                    fxRates,
                                    convertToINR,
                                    inferCurrencyFromSymbol,
                                );
                                if (!suggestions.length)
                                    return <div className="gd-empty">Add holdings to see AI insights.</div>;
                                return (
                                    <div style={{ display: "grid", gap: "14px" }}>
                                        {/* How it works header */}
                                        <div
                                            style={{
                                                background: "rgba(0,208,156,0.06)",
                                                border: "1px solid rgba(0,208,156,0.15)",
                                                borderRadius: "12px",
                                                padding: "12px 16px",
                                                fontSize: "12px",
                                                color: "#888",
                                                lineHeight: 1.6,
                                            }}
                                        >
                                            <span style={{ color: "#00D09C", fontWeight: 700 }}>
                                                🤖 How AI Insights work:{" "}
                                            </span>
                                            Signals are calculated from your{" "}
                                            <strong style={{ color: "#ccc" }}>real portfolio data</strong> — overall P&L
                                            from your buy price (primary signal), today's market momentum (secondary),
                                            and portfolio concentration (risk).{" "}
                                            <strong style={{ color: "#FFD740" }}>Nothing is random.</strong>
                                        </div>

                                        {suggestions.map(s => {
                                            const livePrice =
                                                mergedPrices[s.stock_symbol]?.price || Number(s.average_buy_price);
                                            const sg = s.suggestion;
                                            return (
                                                <div
                                                    key={s.stock_symbol}
                                                    style={{
                                                        background: "#141414",
                                                        border: `1px solid ${sg.color}33`,
                                                        borderLeft: `4px solid ${sg.color}`,
                                                        borderRadius: "14px",
                                                        padding: "16px 20px",
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        gap: "10px",
                                                    }}
                                                >
                                                    {/* Top row: stock name + signal */}
                                                    <div
                                                        style={{
                                                            display: "flex",
                                                            justifyContent: "space-between",
                                                            alignItems: "flex-start",
                                                        }}
                                                    >
                                                        <div>
                                                            <div
                                                                style={{
                                                                    fontSize: "16px",
                                                                    fontWeight: 700,
                                                                    color: "#fff",
                                                                }}
                                                            >
                                                                {s.stock_symbol.replace(".NS", "").replace(".BO", "")}
                                                                <span
                                                                    style={{
                                                                        fontSize: "12px",
                                                                        fontWeight: 400,
                                                                        color: "#666",
                                                                        marginLeft: 8,
                                                                    }}
                                                                >
                                                                    {s.quantity} shares
                                                                </span>
                                                            </div>
                                                            <div
                                                                style={{
                                                                    fontSize: "12px",
                                                                    color: "#555",
                                                                    marginTop: 3,
                                                                }}
                                                            >
                                                                Bought @ ₹{Number(s.average_buy_price).toFixed(2)} · Now
                                                                ₹{livePrice.toFixed(2)}
                                                            </div>
                                                        </div>
                                                        <div
                                                            style={{
                                                                textAlign: "right",
                                                                flexShrink: 0,
                                                                marginLeft: 16,
                                                            }}
                                                        >
                                                            <div
                                                                style={{
                                                                    fontSize: "17px",
                                                                    fontWeight: 800,
                                                                    color: sg.color,
                                                                }}
                                                            >
                                                                {sg.label}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    fontSize: "11px",
                                                                    color: "#555",
                                                                    marginTop: 2,
                                                                }}
                                                            >
                                                                Signal score:{" "}
                                                                <span style={{ color: sg.color, fontWeight: 700 }}>
                                                                    {sg.score?.toFixed(0) ?? sg.confidence.toFixed(0)}
                                                                    /100
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Data chips: shows the actual values used */}
                                                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                                        <span
                                                            style={{
                                                                fontSize: "12px",
                                                                fontWeight: 600,
                                                                padding: "3px 10px",
                                                                borderRadius: "20px",
                                                                background:
                                                                    sg.plPct >= 0
                                                                        ? "rgba(0,200,83,0.12)"
                                                                        : "rgba(255,23,68,0.12)",
                                                                color: sg.plPct >= 0 ? "#00C853" : "#FF5252",
                                                                border: `1px solid ${sg.plPct >= 0 ? "rgba(0,200,83,0.25)" : "rgba(255,23,68,0.2)"}`,
                                                            }}
                                                        >
                                                            Overall P&L: {sg.plPct >= 0 ? "+" : ""}
                                                            {sg.plPct?.toFixed(2)}%
                                                        </span>
                                                        <span
                                                            style={{
                                                                fontSize: "12px",
                                                                fontWeight: 600,
                                                                padding: "3px 10px",
                                                                borderRadius: "20px",
                                                                background:
                                                                    sg.changePct >= 0
                                                                        ? "rgba(0,200,83,0.08)"
                                                                        : "rgba(255,23,68,0.08)",
                                                                color: sg.changePct >= 0 ? "#69F0AE" : "#FF8A80",
                                                                border: `1px solid ${sg.changePct >= 0 ? "rgba(0,200,83,0.15)" : "rgba(255,23,68,0.15)"}`,
                                                            }}
                                                        >
                                                            Today: {sg.changePct >= 0 ? "+" : ""}
                                                            {sg.changePct?.toFixed(2)}%
                                                        </span>
                                                        <span
                                                            style={{
                                                                fontSize: "12px",
                                                                fontWeight: 600,
                                                                padding: "3px 10px",
                                                                borderRadius: "20px",
                                                                background: "rgba(255,255,255,0.05)",
                                                                color: "#aaa",
                                                                border: "1px solid rgba(255,255,255,0.1)",
                                                            }}
                                                        >
                                                            Weight: {sg.weightPct?.toFixed(1)}%
                                                        </span>
                                                    </div>

                                                    {/* Signal score bar */}
                                                    <div>
                                                        <div
                                                            style={{
                                                                display: "flex",
                                                                justifyContent: "space-between",
                                                                fontSize: "10px",
                                                                color: "#444",
                                                                marginBottom: "4px",
                                                            }}
                                                        >
                                                            <span>SELL</span>
                                                            <span>BOOK</span>
                                                            <span>HOLD</span>
                                                            <span>BUY</span>
                                                            <span>STRONG BUY</span>
                                                        </div>
                                                        <div
                                                            style={{
                                                                height: 6,
                                                                background: "#1e1e1e",
                                                                borderRadius: 4,
                                                                overflow: "hidden",
                                                                position: "relative",
                                                            }}
                                                        >
                                                            <div
                                                                style={{
                                                                    height: "100%",
                                                                    width: `${sg.score ?? sg.confidence}%`,
                                                                    background: `linear-gradient(to right, #FF1744, #FF6D00 28%, #FFD740 44%, #00E676 60%, #00C853)`,
                                                                    borderRadius: 4,
                                                                    transition: "width 0.6s ease",
                                                                }}
                                                            />
                                                            <div
                                                                style={{
                                                                    position: "absolute",
                                                                    top: 0,
                                                                    bottom: 0,
                                                                    left: `${sg.score ?? sg.confidence}%`,
                                                                    width: 2,
                                                                    background: "#fff",
                                                                    transform: "translateX(-50%)",
                                                                }}
                                                            />
                                                        </div>
                                                        <div
                                                            style={{
                                                                display: "flex",
                                                                justifyContent: "space-between",
                                                                fontSize: "10px",
                                                                color: "#333",
                                                                marginTop: "2px",
                                                            }}
                                                        >
                                                            <span>0</span>
                                                            <span>25</span>
                                                            <span>50</span>
                                                            <span>75</span>
                                                            <span>100</span>
                                                        </div>
                                                    </div>

                                                    {/* Reasoning */}
                                                    <div
                                                        style={{
                                                            borderTop: "1px solid rgba(255,255,255,0.05)",
                                                            paddingTop: 8,
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                fontSize: "11px",
                                                                color: "#555",
                                                                marginBottom: 6,
                                                                textTransform: "uppercase",
                                                                letterSpacing: "0.5px",
                                                            }}
                                                        >
                                                            Why this signal?
                                                        </div>
                                                        <ul
                                                            style={{
                                                                margin: 0,
                                                                padding: "0 0 0 14px",
                                                                listStyle: "disc",
                                                            }}
                                                        >
                                                            {sg.reasons.map((r, i) => (
                                                                <li
                                                                    key={i}
                                                                    style={{
                                                                        fontSize: "12px",
                                                                        color: "#aaa",
                                                                        marginBottom: 3,
                                                                        lineHeight: 1.5,
                                                                    }}
                                                                >
                                                                    {r}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        <div
                                            style={{
                                                fontSize: "11px",
                                                color: "#444",
                                                textAlign: "center",
                                                padding: "8px 0",
                                            }}
                                        >
                                            ⚠️ AI signals are rule-based analysis, not financial advice. Always do your
                                            own research before investing.
                                        </div>
                                    </div>
                                );
                            })()}

                        {/* ── Risk Heatmap ── */}
                        {holdingsSubTab === "heatmap" && (
                            <RiskHeatmap
                                holdings={holdings}
                                prices={mergedPrices}
                                totalValue={portfolioMetrics.portfolioValue}
                            />
                        )}

                        {/* ── Auto Rebalance ── */}
                        {holdingsSubTab === "rebalance" && (
                            <RebalanceSuggestions
                                holdings={holdings}
                                prices={mergedPrices}
                                totalValue={portfolioMetrics.portfolioValue}
                            />
                        )}
                    </div>
                )}

                {/* ════════ ORDERS TAB ════════ */}
                {activeTab === "Orders" && (
                    <div className="gd-tab-panel">
                        {/* Orders Sub Navigation */}
                        <div className="gd-subtabs">
                            {["All", "Completed", "Pending", "Cancelled"].map(sub => (
                                <button
                                    key={sub}
                                    className={`gd-subtab ${orderSubTab === sub ? "active" : ""}`}
                                    onClick={() => setOrderSubTab(sub)}
                                >
                                    {sub}
                                </button>
                            ))}
                        </div>

                        {/* Orders List */}
                        <div className="gd-list-container">
                            {filteredOrders.length === 0 ? (
                                <div className="gd-empty">No {orderSubTab.toLowerCase()} orders found.</div>
                            ) : (
                                filteredOrders.map(tx => (
                                    <div key={tx.id} className="gd-order-item">
                                        <div className="gd-order-header">
                                            <div className="gd-order-title">
                                                <span
                                                    className={`gd-order-type ${tx.transaction_type === "BUY" ? "buy" : "sell"}`}
                                                >
                                                    {tx.transaction_type}
                                                </span>
                                                <span>{tx.stock_symbol.replace(".NS", "")}</span>
                                            </div>
                                            <div className="gd-order-status completed">{tx.status || "Successful"}</div>
                                        </div>
                                        <div className="gd-order-details">
                                            <div className="gd-od-item">
                                                <span className="gd-od-label">Qty</span>
                                                <span className="gd-od-val">{tx.quantity}</span>
                                            </div>
                                            <div className="gd-od-item">
                                                <span className="gd-od-label">Price</span>
                                                <span className="gd-od-val">₹{Number(tx.price).toFixed(2)}</span>
                                            </div>
                                            <div className="gd-od-item right">
                                                <span className="gd-od-label">Executed</span>
                                                <span className="gd-od-val">{timeAgo(tx.created_at)}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* ════════ POSITIONS TAB ════════ */}
                {activeTab === "Positions" && (
                    <div className="gd-tab-panel">
                        <div
                            className="gd-list-container"
                            style={{ textAlign: "center", padding: "60px 20px", color: "#888" }}
                        >
                            <svg
                                width="48"
                                height="48"
                                fill="none"
                                stroke="#444"
                                strokeWidth="1.5"
                                viewBox="0 0 24 24"
                                style={{ marginBottom: "16px" }}
                            >
                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                            </svg>
                            <h3 style={{ color: "#E0E0E0", fontSize: "18px", marginBottom: "8px" }}>
                                No Open Positions
                            </h3>
                            <p style={{ fontSize: "14px", maxWidth: "400px", margin: "0 auto" }}>
                                You currently do not have any open intraday or F&O positions. Your delivery investments
                                are available in the Holdings tab.
                            </p>
                        </div>
                    </div>
                )}
            </main>
            <VoiceAssistant holdings={holdings} prices={mergedPrices} />
        </div>
    );
}
