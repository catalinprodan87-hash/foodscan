import { Component } from 'react';
import { t } from '../lib/i18n.js';

/** Catches render errors and offers a reload instead of a blank screen. */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('IngrediScan crashed:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const lang = this.props.lang || 'ro';
    return (
      <div className="app">
        <section className="card notice notice-error error-boundary" role="alert">
          <h1 className="card-title">⚠ {t(lang, 'errorTitle2')}</h1>
          <p>{t(lang, 'errorText')}</p>
          <button type="button" className="btn primary" onClick={() => window.location.reload()}>
            {t(lang, 'reload')}
          </button>
        </section>
      </div>
    );
  }
}
