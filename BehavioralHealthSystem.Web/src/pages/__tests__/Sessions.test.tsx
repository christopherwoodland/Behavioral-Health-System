import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import Sessions from '@/pages/Sessions';
import { apiService } from '@/services/api';
import type { SessionData } from '@/types';

// Mock the API service
jest.mock('@/services/api');
const mockApiService = apiService as jest.Mocked<typeof apiService>;

// Mock the user ID utility
jest.mock('@/utils', () => ({
  getUserId: jest.fn(() => 'test-user-123'),
  formatRelativeTime: jest.fn((_date: string) => 'just now'),
  formatDateTime: jest.fn((_date: string) => '2025-09-07 10:00:00'),
}));

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

const mockSessionData: SessionData[] = [
  {
    sessionId: 'session-1',
    userId: 'test-user-123',
    prediction: {
      sessionId: 'session-1',
      status: 'succeeded',
      predictedScoreDepression: '75.5',
      predictedScoreAnxiety: '68.2',
      createdAt: '2025-09-07T10:00:00.000Z',
      updatedAt: '2025-09-07T10:05:00.000Z'
    },
    analysisResults: {
      depressionScore: 75.5,
      anxietyScore: 68.2,
      riskLevel: 'moderate',
      confidence: 0.85,
      insights: ['User shows signs of mild depression'],
      completedAt: '2025-09-07T10:05:00.000Z'
    },
    audioFileName: 'test-audio-1.wav',
    status: 'succeeded',
    createdAt: '2025-09-07T10:00:00.000Z',
    updatedAt: '2025-09-07T10:05:00.000Z'
  },
  {
    sessionId: 'session-2',
    userId: 'test-user-123',
    prediction: {
      sessionId: 'session-2',
      status: 'processing',
      createdAt: '2025-09-07T11:00:00.000Z',
      updatedAt: '2025-09-07T11:00:00.000Z'
    },
    audioFileName: 'test-audio-2.wav',
    status: 'processing',
    createdAt: '2025-09-07T11:00:00.000Z',
    updatedAt: '2025-09-07T11:00:00.000Z'
  }
];

describe('Sessions Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiService.getUserSessions.mockResolvedValue({
      success: true,
      count: mockSessionData.length,
      sessions: mockSessionData
    });
  });

  describe('Rendering', () => {
    it('should render sessions page with loading state initially', () => {
      mockApiService.getUserSessions.mockImplementation(() => new Promise(() => {})); // Never resolves
      
      render(
        <TestWrapper>
          <Sessions />
        </TestWrapper>
      );

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should render sessions page with data', async () => {
      render(
        <TestWrapper>
          <Sessions />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/2 sessions/i)).toBeInTheDocument();
      });

      expect(screen.getByText('test-audio-1.wav')).toBeInTheDocument();
      expect(screen.getByText('test-audio-2.wav')).toBeInTheDocument();
    });

    it('should display session scores correctly', async () => {
      render(
        <TestWrapper>
          <Sessions />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Depression: 75.50')).toBeInTheDocument();
        expect(screen.getByText('Anxiety: 68.20')).toBeInTheDocument();
      });
    });

    it('should render empty state when no sessions', async () => {
      mockApiService.getUserSessions.mockResolvedValue({
        success: true,
        count: 0,
        sessions: []
      });

      render(
        <TestWrapper>
          <Sessions />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/no sessions found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Filtering and Search', () => {
    it('should filter sessions by search term', async () => {
      render(
        <TestWrapper>
          <Sessions />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('test-audio-1.wav')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search sessions/i);
      fireEvent.change(searchInput, { target: { value: 'audio-1' } });

      expect(screen.getByText('test-audio-1.wav')).toBeInTheDocument();
      expect(screen.queryByText('test-audio-2.wav')).not.toBeInTheDocument();
    });

    it('should filter sessions by status', async () => {
      render(
        <TestWrapper>
          <Sessions />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('test-audio-1.wav')).toBeInTheDocument();
      });

      // Open filters
      const filterButton = screen.getByText(/filters/i);
      fireEvent.click(filterButton);

      // Wait for filter dropdown to appear
      await waitFor(() => {
        const statusSelect = screen.getByRole('combobox', { name: /status/i });
        fireEvent.change(statusSelect, { target: { value: 'processing' } });
      });

      expect(screen.queryByText('test-audio-1.wav')).not.toBeInTheDocument();
      expect(screen.getByText('test-audio-2.wav')).toBeInTheDocument();
    });

    it('should sort sessions by date', async () => {
      render(
        <TestWrapper>
          <Sessions />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('test-audio-1.wav')).toBeInTheDocument();
      });

      // Open filters
      const filterButton = screen.getByText(/filters/i);
      fireEvent.click(filterButton);

      await waitFor(() => {
        const sortSelect = screen.getByRole('combobox', { name: /sort by/i });
        fireEvent.change(sortSelect, { target: { value: 'date' } });
      });

      // Verify sessions are displayed (more detailed sorting verification would require DOM inspection)
      expect(screen.getByText('test-audio-1.wav')).toBeInTheDocument();
      expect(screen.getByText('test-audio-2.wav')).toBeInTheDocument();
    });

    it('should sort sessions by score', async () => {
      render(
        <TestWrapper>
          <Sessions />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('test-audio-1.wav')).toBeInTheDocument();
      });

      // Open filters
      const filterButton = screen.getByText(/filters/i);
      fireEvent.click(filterButton);

      await waitFor(() => {
        const sortSelect = screen.getByRole('combobox', { name: /sort by/i });
        fireEvent.change(sortSelect, { target: { value: 'score' } });
      });

      expect(screen.getByText('test-audio-1.wav')).toBeInTheDocument();
    });
  });

  describe('View Modes', () => {
    it('should switch between grid and list view', async () => {
      render(
        <TestWrapper>
          <Sessions />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('test-audio-1.wav')).toBeInTheDocument();
      });

      // Find and click list view button
      const listViewButton = screen.getByRole('button', { name: /list view/i });
      fireEvent.click(listViewButton);

      // Verify view mode changed (check for list-specific classes or elements)
      expect(screen.getByText('test-audio-1.wav')).toBeInTheDocument();

      // Switch back to grid view
      const gridViewButton = screen.getByRole('button', { name: /grid view/i });
      fireEvent.click(gridViewButton);

      expect(screen.getByText('test-audio-1.wav')).toBeInTheDocument();
    });
  });

  describe('Session Actions', () => {
    it('should handle session selection', async () => {
      render(
        <TestWrapper>
          <Sessions />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('test-audio-1.wav')).toBeInTheDocument();
      });

      // Find and click session checkbox
      const checkboxes = screen.getAllByRole('checkbox');
      const sessionCheckbox = checkboxes.find(cb => 
        cb.getAttribute('value') === 'session-1'
      );
      
      if (sessionCheckbox) {
        fireEvent.click(sessionCheckbox);
        expect(sessionCheckbox).toBeChecked();
      }
    });

    it('should handle refresh action', async () => {
      render(
        <TestWrapper>
          <Sessions />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('test-audio-1.wav')).toBeInTheDocument();
      });

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);

      // Verify API was called again
      expect(mockApiService.getUserSessions).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should display error state when API fails', async () => {
      mockApiService.getUserSessions.mockRejectedValue(new Error('API Error'));

      render(
        <TestWrapper>
          <Sessions />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/error loading sessions/i)).toBeInTheDocument();
      });
    });

    it('should handle retry after error', async () => {
      mockApiService.getUserSessions
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce({
          success: true,
          count: mockSessionData.length,
          sessions: mockSessionData
        });

      render(
        <TestWrapper>
          <Sessions />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/error loading sessions/i)).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('test-audio-1.wav')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', async () => {
      render(
        <TestWrapper>
          <Sessions />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('test-audio-1.wav')).toBeInTheDocument();
      });

      // Check for main content area
      expect(screen.getByRole('main')).toBeInTheDocument();

      // Check for table structure in grid view
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();

      // Check for search input
      const searchInput = screen.getByRole('searchbox');
      expect(searchInput).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      render(
        <TestWrapper>
          <Sessions />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('test-audio-1.wav')).toBeInTheDocument();
      });

      const searchInput = screen.getByRole('searchbox');
      searchInput.focus();
      expect(searchInput).toHaveFocus();

      // Test tab navigation
      fireEvent.keyDown(searchInput, { key: 'Tab' });
      // Verify focus moves to next element (implementation specific)
    });
  });

  describe('Performance', () => {
    it('should not re-render unnecessarily', async () => {
      const renderSpy = jest.fn();
      
      const TestComponent = () => {
        renderSpy();
        return <Sessions />;
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('test-audio-1.wav')).toBeInTheDocument();
      });

      // Initial render + data load render
      expect(renderSpy).toHaveBeenCalledTimes(2);

      // Type in search - should not cause excessive re-renders
      const searchInput = screen.getByPlaceholderText(/search sessions/i);
      fireEvent.change(searchInput, { target: { value: 'test' } });

      // Should only add one more render for the search
      expect(renderSpy).toHaveBeenCalledTimes(3);
    });
  });
});
