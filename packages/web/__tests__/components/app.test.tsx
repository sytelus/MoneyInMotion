/**
 * Smoke test to verify the App component renders without crashing.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { App } from '../../src/App.js';

describe('App', () => {
  it('renders without crashing', async () => {
    render(<App />);
    // The real landing route is lazy-loaded. Cold transforms in the parallel
    // monorepo suite can exceed Testing Library's one-second default; wait for
    // the actual header, not merely the Suspense loading text.
    expect(await screen.findByText('MoneyInMotion', {}, { timeout: 4000 })).toBeInTheDocument();
  });
});
