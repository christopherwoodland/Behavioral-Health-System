import { useContext } from 'react';
import { AuthContext } from './AuthContext';
import type { AuthContextType } from './AuthContext';

// Hook to use the auth context (kept in its own module so AuthContext.tsx only exports components)
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
