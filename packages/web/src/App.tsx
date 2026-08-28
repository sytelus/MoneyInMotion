/**
 * Root application component.
 *
 * Sets up React Query for server state management and React Router for
 * client-side navigation.
 *
 * @module
 */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell.js';
import { AccountsPage } from './pages/AccountsPage.js';
import { RulesPage } from './pages/RulesPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { WelcomePage } from './pages/WelcomePage.js';

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
          <Routes>
            <Route path="/" element={<AppShell />} />
            <Route path="/welcome" element={<WelcomePage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/rules" element={<RulesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

App.displayName = 'App';
