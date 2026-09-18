/**
 * Responsive primary application navigation.
 *
 * Imports and edits persist automatically, so the header exposes destinations
 * instead of legacy Scan/Save commands that implied unsaved in-memory state.
 *
 * @module
 */

import React, { useCallback, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  CircleDollarSign,
  ChartNoAxesCombined,
  CreditCard,
  HelpCircle,
  History,
  Settings,
  UploadCloud,
} from 'lucide-react';
import { Button } from '../ui/button.js';
import { KeyboardShortcutsDialog } from './KeyboardShortcutsDialog.js';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts.js';
import { cn } from '../../lib/utils.js';

const navItems = [
  { to: '/', label: 'Overview', icon: ChartNoAxesCombined },
  { to: '/transactions', label: 'Transactions', icon: CircleDollarSign },
  { to: '/imports', label: 'Imports', icon: UploadCloud },
  { to: '/accounts', label: 'Accounts', icon: CreditCard },
  { to: '/rules', label: 'Rules', icon: History },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const;

export const Header: React.FC = () => {
  const [helpOpen, setHelpOpen] = useState(false);
  const handleShowHelp = useCallback(() => setHelpOpen(true), []);
  useKeyboardShortcuts({ onShowHelp: handleShowHelp });

  return (
    <header className="app-header flex shrink-0 flex-wrap items-center gap-x-3 border-b border-border bg-background px-3 pt-3 shadow-sm sm:px-5 xl:flex-nowrap xl:py-2">
      <Link
        to="/"
        className="mr-auto flex min-w-0 items-center gap-2.5 font-bold tracking-tight text-foreground transition-opacity hover:opacity-80"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-sm">
          <CircleDollarSign className="h-5 w-5" />
        </span>
        <span className="text-lg">MoneyInMotion</span>
      </Link>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleShowHelp}
        title="Keyboard shortcuts (?)"
        aria-label="Show keyboard shortcuts"
        className="xl:order-last"
      >
        <HelpCircle className="h-4 w-4" />
      </Button>
      <nav
        aria-label="Primary navigation"
        className="grid w-full grid-cols-3 items-center gap-1 py-2 sm:flex sm:overflow-x-auto xl:w-auto xl:py-0"
      >
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            aria-label={label}
            title={label}
            className={({ isActive }) =>
              cn(
                'inline-flex h-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground sm:h-10 sm:flex-row sm:gap-1.5 sm:px-3 sm:text-sm',
                isActive && 'bg-sky-50 text-sky-900 ring-1 ring-inset ring-sky-200',
              )
            }
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <KeyboardShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </header>
  );
};

Header.displayName = 'Header';
