import { describe, it, expect, vi } from 'vitest';
import { Header } from '../Header';

// Mock the dependencies
vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: vi.fn(() => ({
    theme: 'light',
    toggleTheme: vi.fn(),
  })),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
    getAccessToken: vi.fn(),
  })),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useLocation: vi.fn(() => ({ pathname: '/' })),
    Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
  };
});

vi.mock('@/hooks/accessibility', () => ({
  useKeyboardNavigation: vi.fn(() => ({
    handleEnterSpace: vi.fn(),
  })),
  useAnnouncements: vi.fn(() => ({
    announce: vi.fn(),
  })),
  useFocusManagement: vi.fn(() => ({
    focusRef: { current: null },
  })),
  useSkipToContent: vi.fn(),
  useFormAccessibility: vi.fn(() => ({
    getFieldProps: vi.fn(),
  })),
  useStatusAnnouncements: vi.fn(() => ({
    announceStatus: vi.fn(),
  })),
}));

vi.mock('@/hooks/api', () => ({
  useHealthCheck: vi.fn(() => ({
    data: { status: 'Healthy', airGapMode: true, aiModel: 'phi4-mini' },
    isLoading: false,
    error: null,
  })),
}));

describe('Header Component', () => {
  it('should be defined and importable', () => {
    expect(Header).toBeDefined();
    expect(typeof Header).toBe('function');
  });
});
