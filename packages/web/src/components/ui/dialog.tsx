/**
 * Dialog component wrapping Radix UI Dialog primitives.
 *
 * Provides a modal overlay with title, optional description, and footer slot.
 *
 * @module
 */

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils.js';

/**
 * Root dialog component controlling open/close state.
 */
export const Dialog = DialogPrimitive.Root;

/**
 * Trigger element that opens the dialog when clicked.
 */
export const DialogTrigger = DialogPrimitive.Trigger;

/**
 * Close element that closes the dialog when clicked.
 */
export const DialogClose = DialogPrimitive.Close;

export interface DialogContentProps {
  /** Dialog title displayed in the header. */
  title: string;
  /** Optional description below the title. */
  description?: string;
  /** Content rendered inside the dialog body. */
  children: React.ReactNode;
  /** Additional CSS class names for the content container. */
  className?: string;
}

/**
 * Dialog content panel rendered inside a portal with an overlay backdrop.
 * Includes a title bar with close button, optional description, and
 * scrollable body area.
 */
export const DialogContent: React.FC<DialogContentProps> = ({
  title,
  description,
  children,
  className,
}) => {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-lg border border-border bg-background p-6 shadow-lg focus:outline-none',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          className,
        )}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <DialogPrimitive.Title className="text-lg font-semibold text-foreground">
              {title}
            </DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                {description}
              </DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
};

DialogContent.displayName = 'DialogContent';

export interface DialogFooterProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Footer area for dialog action buttons, right-aligned with gap spacing.
 */
export const DialogFooter: React.FC<DialogFooterProps> = ({ children, className }) => {
  return (
    <div className={cn('flex justify-end gap-2 mt-6', className)}>
      {children}
    </div>
  );
};

DialogFooter.displayName = 'DialogFooter';
