import { Component } from 'react';
import './ErrorBoundary.css';

/**
 * App-level error boundary — prevents component crashes from unmounting the whole tree.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // In production you'd send to an error tracking service here
    console.error('[SPMS Error Boundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="eb-icon">
            <svg width="40" height="40" fill="none" stroke="#ff4757" strokeWidth="1.5" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <circle cx="12" cy="16" r="0.5" fill="#ff4757"/>
            </svg>
          </div>
          <h3>Something went wrong</h3>
          <p className="eb-msg">{this.state.error?.message || 'An unexpected error occurred.'}</p>
          <button className="eb-btn" onClick={() => this.setState({ hasError: false, error: null })}>
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
