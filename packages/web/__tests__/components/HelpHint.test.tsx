import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HelpHint } from '../../src/components/ui/help-hint.js';
import { Dialog, DialogContent } from '../../src/components/ui/dialog.js';

describe('Help hints', () => {
  it('closes only nested help on Escape and returns to the editor', async () => {
    function Editor() {
      const [open, setOpen] = React.useState(true);
      return (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent title="Editor">
            <HelpHint title="Nested help">Explanation</HelpHint>
          </DialogContent>
        </Dialog>
      );
    }
    render(<Editor />);
    const opener = screen.getByRole('button', { name: 'Explain Nested help' });
    opener.focus();
    fireEvent.click(opener);
    expect(await screen.findByRole('dialog', { name: 'Nested help' })).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Nested help' })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('dialog', { name: 'Editor' })).toBeInTheDocument();
    await waitFor(() => expect(opener).toHaveFocus());
  });
  it('returns keyboard focus to the opener after Escape', async () => {
    render(<HelpHint title="Review marks">A reminder, not an exclusion from totals.</HelpHint>);
    const opener = screen.getByRole('button', { name: 'Explain Review marks' });
    opener.focus();
    fireEvent.click(opener);
    expect(await screen.findByRole('dialog', { name: 'Review marks' })).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());
  });
});
