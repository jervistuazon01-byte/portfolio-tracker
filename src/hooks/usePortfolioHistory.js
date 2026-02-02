import { useState, useEffect, useRef } from 'react';
import { getStockCandles } from '../services/api';

export function usePortfolioHistory(portfolio) {
    const [history, setHistory] = useState({});
    const [loading, setLoading] = useState(false);

    // Cache: { [symbol]: { data: object, timestamp: number } }
    const cache = useRef({});

    useEffect(() => {
        let mounted = true;
        const now = Math.floor(Date.now() / 1000);
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60);
        const STALE_THRESHOLD = 3600; // 1 hour

        const neededSymbols = portfolio.map(s => s.symbol);

        // Identify symbols that need fetching
        const toFetch = neededSymbols.filter(symbol => {
            const entry = cache.current[symbol];
            if (!entry) return true; // Not in cache
            if (now - entry.timestamp > STALE_THRESHOLD) return true; // Stale
            return false;
        });

        const updateHistoryFromCache = () => {
            const newHistory = {};
            neededSymbols.forEach(symbol => {
                const entry = cache.current[symbol];
                if (entry) {
                    newHistory[symbol] = entry.data;
                }
            });
            // Only update state if it's different (shallow comparison of keys/values might be expensive,
            // but setting a new object always triggers render, which is fine as this happens after fetch or portfolio change)
            setHistory(newHistory);
        };

        if (toFetch.length === 0) {
            updateHistoryFromCache();
            return;
        }

        const fetchMissing = async () => {
            setLoading(true);

            const promises = toFetch.map(async (symbol) => {
                try {
                    const data = await getStockCandles(symbol, 'D', thirtyDaysAgo, now);
                    if (data && data.s === 'ok' && data.t && data.c) {
                        return { symbol, data, success: true };
                    }
                } catch (error) {
                    console.error(`Failed to fetch candles for ${symbol}`, error);
                }
                return { symbol, success: false };
            });

            const results = await Promise.all(promises);

            if (!mounted) return;

            results.forEach(res => {
                if (res.success) {
                    cache.current[res.symbol] = {
                        data: res.data,
                        timestamp: Math.floor(Date.now() / 1000)
                    };
                }
            });

            updateHistoryFromCache();
            setLoading(false);
        };

        fetchMissing();

        return () => {
            mounted = false;
        };
    }, [portfolio]);

    return { history, loading };
}
