import React from 'react';
import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import {LanguageProvider} from './i18n/translations.tsx';
import './index.css';

try {
  registerSW({immediate: true});
} catch {
  // Ignore service worker registration errors in restricted contexts
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class RootErrorBoundary extends React.Component<
  {children: React.ReactNode},
  ErrorBoundaryState
> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = {hasError: false, message: ''};
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          style={{
            minHeight: '100vh',
            backgroundColor: '#070C14',
            color: '#F1F5F9',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            textAlign: 'center',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h1 style={{fontSize: '20px', fontWeight: 700, marginBottom: '8px'}}>
            تعذر تشغيل التطبيق مؤقتاً
          </h1>
          <p style={{fontSize: '14px', color: '#94A3B8', maxWidth: '420px'}}>
            حدث خطأ غير متوقع أثناء التحميل ({this.state.message}). جرّب إعادة تحميل الصفحة.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: '16px',
              padding: '10px 20px',
              borderRadius: '8px',
              backgroundColor: '#06B6D4',
              color: '#020617',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            إعادة تحميل الصفحة
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

(window as {__RADIOLOGY_APP_MOUNTED__?: boolean}).__RADIOLOGY_APP_MOUNTED__ = true;

createRoot(document.getElementById('root')!).render(
  <RootErrorBoundary>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </RootErrorBoundary>
);
