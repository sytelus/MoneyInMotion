/**
 * Smoke test to verify the App component renders without crashing.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { App } from '../../src/App.js';

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);
    // The header should contain the app title
    expect(screen.getByText('MoneyInMotion')).toBeInTheDocument();
  });
});
