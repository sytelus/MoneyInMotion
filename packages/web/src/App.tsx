/**
 * Root application component.
 *
 * Sets up React Query for server state management and React Router for
 * client-side navigation.
 *
 * @module
 */

import React, { Suspense, lazy } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';

// Route-level splitting keeps account/settings/rule management code out of
// the initial transaction-screen download. Named exports are adapted to the
// default shape expected by React.lazy without adding wrapper modules.
const AppShell = lazy(() =>
  import('./components/layout/AppShell.js').then((module) => ({ default: module.AppShell })),
);
const AccountsPage = lazy(() =>
  import('./pages/AccountsPage.js').then((module) => ({ default: module.AccountsPage })),
);
const RulesPage = lazy(() =>
  import('./pages/RulesPage.js').then((module) => ({ default: module.RulesPage })),
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage.js').then((module) => ({ default: module.SettingsPage })),
);
const WelcomePage = lazy(() =>
  import('./pages/WelcomePage.js').then((module) => ({ default: module.WelcomePage })),
);
const ReportsPage = lazy(() =>
  import('./pages/ReportsPage.js').then((module) => ({ default: module.ReportsPage })),
);
const ImportsPage = lazy(() =>
  import('./pages/ImportsPage.js').then((module) => ({ default: module.ImportsPage })),
);

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen p-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
            <p className="text-muted-foreground mb-4">{this.state.error?.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

/**
 * Top-level App component wrapping the entire application in the required
 * providers (React Query, React Router).
 */
export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ErrorBoundary>
          <Suspense
            fallback={
              <div className="flex min-h-screen items-center justify-center text-muted-foreground">
                Loading MoneyInMotion…
              </div>
            }
          >
            <Routes>
              <Route path="/" element={<ReportsPage />} />
              <Route path="/reports" element={<Navigate to="/" replace />} />
              <Route path="/transactions" element={<AppShell />} />
              <Route path="/imports" element={<ImportsPage />} />
              <Route path="/welcome" element={<WelcomePage />} />
              <Route path="/accounts" element={<AccountsPage />} />
              <Route path="/rules" element={<RulesPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

App.displayName = 'App';
