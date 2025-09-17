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
  useAuth: vi.fn(),
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
}));

describe('Header Component', () => {
  it('should be defined and importable', () => {
    expect(Header).toBeDefined();
    expect(typeof Header).toBe('function');
  });
});