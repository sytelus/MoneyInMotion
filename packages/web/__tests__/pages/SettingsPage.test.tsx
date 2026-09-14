import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SettingsPage } from '../../src/pages/SettingsPage.js';

const getConfigMock = vi.fn();
const updateConfigMock = vi.fn();
const useRebuildSnapshotMock = vi.fn();

vi.mock('../../src/api/client.js', () => ({
  getConfig: (...args: unknown[]) => getConfigMock(...args),
  updateConfig: (...args: unknown[]) => updateConfigMock(...args),
}));

vi.mock('../../src/api/hooks.js', () => ({
  useRebuildSnapshot: () => useRebuildSnapshotMock(),
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
      dataRoot: '/tmp/mim_root',
      username: 'alex',
      userDataPath: '/tmp/mim_root/alex',
      statementsDir: '/tmp/mim-data/Statements',
      mergedDir: '/tmp/mim-data/Merged',
      stagingDir: '/tmp/mim-data/staging',
      activePort: 3001,
      activeDataRoot: '/tmp/mim_root',
      activeUsername: 'alex',
      activeUserDataPath: '/tmp/mim_root/alex',
      restartRequired: false,
    });
    useRebuildSnapshotMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isSuccess: false,
      data: null,
      isError: false,
      error: null,
    });
  });

  it('loads and saves the data root, username, and port', async () => {
    updateConfigMock.mockResolvedValue({
      port: 4010,
      dataRoot: '/tmp/mim_root-2',
      username: 'sam',
      userDataPath: '/tmp/mim_root-2/sam',
      statementsDir: '/tmp/mim_root-2/sam/Statements',
      mergedDir: '/tmp/mim_root-2/sam/Merged',
      stagingDir: '/tmp/mim_root-2/sam/staging',
      activePort: 3001,
      activeDataRoot: '/tmp/mim_root',
      activeUsername: 'alex',
      activeUserDataPath: '/tmp/mim_root/alex',
      restartRequired: true,
    });

    renderPage();

    const dataRootInput = await screen.findByLabelText('Data Root');
    const usernameInput = screen.getByLabelText('Active Username');
    const portInput = screen.getByLabelText('Server Port');

    fireEvent.change(dataRootInput, { target: { value: '/tmp/mim_root-2' } });
    fireEvent.change(usernameInput, { target: { value: 'sam' } });
    fireEvent.change(portInput, { target: { value: '4010' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Settings/i }));

    await waitFor(() => {
      expect(updateConfigMock).toHaveBeenCalledWith({
        dataRoot: '/tmp/mim_root-2',
        username: 'sam',
        port: 4010,
      });
    });

    expect(
      await screen.findByText(/Saved data root and username and port to the config file/i),
    ).toBeInTheDocument();
  });

  it('only sends dataRoot when the username and port are unchanged', async () => {
    updateConfigMock.mockResolvedValue({
      port: 3001,
      dataRoot: '/tmp/mim_root-2',
      username: 'alex',
      userDataPath: '/tmp/mim_root-2/alex',
      statementsDir: '/tmp/mim_root-2/alex/Statements',
      mergedDir: '/tmp/mim_root-2/alex/Merged',
      stagingDir: '/tmp/mim_root-2/alex/staging',
      activePort: 3001,
      activeDataRoot: '/tmp/mim_root',
      activeUsername: 'alex',
      activeUserDataPath: '/tmp/mim_root/alex',
      restartRequired: true,
    });

    renderPage();

    fireEvent.change(await screen.findByLabelText('Data Root'), {
      target: { value: '/tmp/mim_root-2' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Settings/i }));

    await waitFor(() => {
      expect(updateConfigMock).toHaveBeenCalledWith({
        dataRoot: '/tmp/mim_root-2',
      });
    });
    expect(await screen.findByText(/Saved data root to the config file/i)).toBeInTheDocument();
    // The restart hint should reference only "data directory", not "port".
    expect(
      screen.getByText(/Restart the server for the new data root to take effect/i),
    ).toBeInTheDocument();
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
