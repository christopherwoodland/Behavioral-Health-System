import { describe, it, expect, vi } from 'vitest';
import { RoleBasedRedirect } from '../RoleBasedRedirect';

// Mock the dependencies
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(),
    useLocation: vi.fn(),
  };
});

describe('RoleBasedRedirect', () => {
  it('should be defined and importable', () => {
    expect(RoleBasedRedirect).toBeDefined();
    expect(typeof RoleBasedRedirect).toBe('function');
  });
});