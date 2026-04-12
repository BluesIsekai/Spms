import { useState, useEffect, useRef } from 'react';
import { searchStocks } from '../services/searchService';

/**
 * A custom hook encapsulating the 300ms autocomplete debounce engine.
 * @param {number} delayMs - Search buffer delay in milliseconds.
 */
export function useDebouncedSearch(delayMs = 300) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    // Clear any pending triggers
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!query || query.trim().length === 0) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    // Set loading indicator immediately
    setIsSearching(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchStocks(query);
        setResults(data || []);
      } catch (err) {
        console.error('Search evaluation error:', err);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, delayMs);

    return () => clearTimeout(debounceRef.current);
  }, [query, delayMs]);

  const clearSearch = () => {
    setQuery('');
    setResults([]);
  };

  return {
    query,
    setQuery,
    results,
    isSearching,
    clearSearch,
  };
}
