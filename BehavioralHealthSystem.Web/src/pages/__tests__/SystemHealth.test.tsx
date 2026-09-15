import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useHealthCheck } from '@/hooks/api';
import { SystemHealth } from '../index';

vi.mock('@/hooks/api', () => ({
  useHealthCheck: vi.fn(),
}));

vi.mock('@/hooks/accessibility', () => ({
  useAnnouncements: () => ({ announce: vi.fn() }),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

describe('SystemHealth', () => {
  beforeEach(() => {
    vi.mocked(useHealthCheck).mockReturnValue({
      data: {
        status: 'Healthy',
        totalDuration: 0.005,
        airGapMode: false,
        aiModel: 'cloud',
        resources: {
          storageAccount: 'cwacstest001',
          speechToText: 'mai-transcribe-1.5 / verbatim',
          foundryAgents: 'Extended v5',
        },
        entries: {
          database: {
            status: 'Healthy',
            description: 'Database connection succeeded',
            duration: 1.25,
          },
        },
      },
      dataUpdatedAt: new Date('2026-09-15T01:49:51Z').getTime(),
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useHealthCheck>);
  });

  it('renders API health and backend component entries without unsupported status claims', () => {
    render(<SystemHealth />);

    expect(screen.getByRole('heading', { name: 'API Status' })).toBeInTheDocument();
    expect(screen.getByText('mai-transcribe-1.5 / verbatim')).toBeInTheDocument();
    expect(screen.getByText('Extended v5')).toBeInTheDocument();
    expect(screen.getByText('Database connection succeeded')).toBeInTheDocument();
    expect(screen.getByText('Refresh on demand')).toBeInTheDocument();
    expect(screen.queryByText('Auto-refresh Enabled')).not.toBeInTheDocument();
    expect(screen.queryByText('Real-time Updates')).not.toBeInTheDocument();
  });
});
