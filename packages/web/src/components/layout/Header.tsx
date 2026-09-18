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
  CreditCard,
  HelpCircle,
  History,
  Settings,
  UploadCloud,
} from 'lucide-react';
import { Button, buttonClassName } from '../ui/button.js';
import { KeyboardShortcutsDialog } from './KeyboardShortcutsDialog.js';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts.js';
import { cn } from '../../lib/utils.js';

const navItems = [
  { to: '/', label: 'Transactions', icon: CircleDollarSign },
  { to: '/accounts', label: 'Accounts', icon: CreditCard },
  { to: '/rules', label: 'Rules', icon: History },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const;

export const Header: React.FC = () => {
  const [helpOpen, setHelpOpen] = useState(false);
  const handleShowHelp = useCallback(() => setHelpOpen(true), []);
  useKeyboardShortcuts({ onShowHelp: handleShowHelp });

  return (
    <header className="flex min-h-16 shrink-0 items-center gap-3 border-b border-border/80 bg-background/95 px-3 shadow-sm backdrop-blur sm:px-5">
      <Link
        to="/"
        className="mr-auto flex min-w-0 items-center gap-2.5 font-bold tracking-tight text-foreground transition-opacity hover:opacity-80"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-sm">
          <CircleDollarSign className="h-5 w-5" />
        </span>
        <span className="hidden text-lg sm:block">MoneyInMotion</span>
        <span className="text-lg sm:hidden">MiM</span>
      </Link>

      <Link
        to="/accounts"
        className={buttonClassName({ size: 'sm', className: 'hidden md:inline-flex' })}
      >
        <UploadCloud className="mr-1.5 h-4 w-4" />
        Import statements
      </Link>

      <nav aria-label="Primary navigation" className="flex items-center gap-0.5">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            aria-label={label}
            title={label}
            className={({ isActive }) =>
              cn(
                'inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground sm:px-3',
                isActive && 'bg-accent text-accent-foreground',
              )
            }
          >
            <Icon className="h-4 w-4" />
            <span className="hidden lg:inline">{label}</span>
          </NavLink>
        ))}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleShowHelp}
          title="Keyboard shortcuts (?)"
          aria-label="Show keyboard shortcuts"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      </nav>

      <KeyboardShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </header>
  );
};

Header.displayName = 'Header';
