/**
 * Design Tokens - Centralized visual design system
 * Ensures consistency across all pages and components
 */

export const COLORS = {
  // Backgrounds
  bg: {
    primary: '#121317',    // Main app background
    surface: '#1a1b20',    // Card/surface background
    hover: '#1f2128',      // Hover state background
    active: '#262a35',     // Active/focus state
    input: 'rgba(30, 31, 35, 0.8)',  // Input backgrounds
  },

  // Text
  text: {
    primary: '#e3e2e8',    // Main text
    secondary: '#859398',  // Secondary text
    tertiary: '#5a6872',   // Tertiary text
    muted: 'rgba(60, 73, 78, 0.4)',  // Muted text
  },

  // Accent colors
  accent: {
    cyan: '#00d4ff',       // Primary action (cyan)
    cyan_light: '#33ddff', // Hover state
    purple: '#b6c4ff',     // Secondary accent
    blue: '#2962ff',       // Deep blue accent
  },

  // Semantic colors
  status: {
    success: '#00c896',    // Green for profit/gain
    error: '#ff4757',      // Red for loss/error
    warning: '#ffa502',    // Orange for warning
    info: '#00d4ff',       // Cyan for info
  },

  // Borders
  border: {
    primary: 'rgba(60, 73, 78, 0.3)',
    secondary: 'rgba(60, 73, 78, 0.15)',
    hover: 'rgba(0, 212, 255, 0.15)',
    focus: '#00d4ff',
  },
};

export const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  xxl: '24px',
  xxxl: '30px',
  '4xl': '40px',
};

export const TYPOGRAPHY = {
  font: {
    family: "'Inter', system-ui, sans-serif",
  },
  
  sizes: {
    h1: '28px',
    h2: '22px',
    h3: '18px',
    body: '16px',
    sm: '14px',
    xs: '13px',
    tiny: '10px',
  },

  weights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },

  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.8,
  },
};

export const BORDER_RADIUS = {
  none: '0',
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  full: '50%',
};

export const SHADOWS = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px rgba(0, 0, 0, 0.2)',
  xl: '0 20px 25px rgba(0, 0, 0, 0.3)',
};

export const TRANSITIONS = {
  fast: '0.15s ease',
  normal: '0.2s ease',
  slow: '0.3s ease',
};

// Helper function to format currency (Indian Rupees)
export function formatCurrency(value, currency = 'INR') {
  const symbolMap = { INR: '₹', USD: '$', GBP: '£', EUR: '€', JPY: '¥' };
  const symbol = symbolMap[currency] || `${currency} `;
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  return `${symbol}${Number(value || 0).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Helper function to format percentage
export function formatPercent(value) {
  return `${value >= 0 ? '+' : ''}${Number(value || 0).toFixed(2)}%`;
}

// Get status color based on value
export function getStatusColor(value) {
  return value >= 0 ? COLORS.status.success : COLORS.status.error;
}

// Get status class for styling
export function getStatusClass(value) {
  return value >= 0 ? 'up' : 'down';
}
