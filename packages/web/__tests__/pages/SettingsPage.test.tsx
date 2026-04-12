import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SettingsPage } from '../../src/pages/SettingsPage.js';

const getConfigMock = vi.fn();
const updateConfigMock = vi.fn();
const useScanStatementsMock = vi.fn();
const useSaveDataMock = vi.fn();

vi.mock('../../src/api/client.js', () => ({
  getConfig: (...args: unknown[]) => getConfigMock(...args),
  updateConfig: (...args: unknown[]) => updateConfigMock(...args),
}));

vi.mock('../../src/api/hooks.js', () => ({
  useScanStatements: () => useScanStatementsMock(),
  useSaveData: () => useSaveDataMock(),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  );
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConfigMock.mockResolvedValue({
      port: 3001,
      dataPath: '/tmp/mim-data',
      statementsDir: '/tmp/mim-data/Statements',
      mergedDir: '/tmp/mim-data/Merged',
    });
    useScanStatementsMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isSuccess: false,
      data: null,
      isError: false,
      error: null,
    });
    useSaveDataMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    });
  });

  it('loads and saves both data path and port', async () => {
    updateConfigMock.mockResolvedValue({
      port: 4010,
      dataPath: '/tmp/mim-data-2',
      statementsDir: '/tmp/mim-data-2/Statements',
      mergedDir: '/tmp/mim-data-2/Merged',
    });

    renderPage();

    const dataPathInput = await screen.findByLabelText('Data Directory');
    const portInput = screen.getByLabelText('Server Port');

    fireEvent.change(dataPathInput, { target: { value: '/tmp/mim-data-2' } });
    fireEvent.change(portInput, { target: { value: '4010' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Settings/i }));

    await waitFor(() => {
      expect(updateConfigMock).toHaveBeenCalledWith({
        dataPath: '/tmp/mim-data-2',
        port: 4010,
      });
    });

    expect(await screen.findByText(/Settings saved to the config file/i)).toBeInTheDocument();
  });

  it('shows validation for an invalid port and does not call updateConfig', async () => {
    renderPage();

    fireEvent.change(await screen.findByLabelText('Server Port'), {
      target: { value: '70000' },
    });

    expect(screen.getByText(/Port must be an integer between 1 and 65535/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Settings/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Save Settings/i }));

    expect(updateConfigMock).not.toHaveBeenCalled();
  });
});
