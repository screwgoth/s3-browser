"use client";

import React, { createContext, useState, useContext, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { UserRole } from './UserContext';

export interface User {
  username: string;
  role: UserRole;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  isAdmin: boolean;
  role: UserRole | null;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Keys written by the old localStorage-based implementation — cleared on first load.
const STALE_LS_KEYS = ['s3-user', 's3-users', 's3-buckets', 's3-bucket-assignments'];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    // One-time cleanup: purge stale keys written by the old localStorage implementation.
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        STALE_LS_KEYS.forEach(key => window.localStorage.removeItem(key));
      }
    } catch { /* storage blocked — ignore */ }

    const restoreSession = async () => {
      try {
        const response = await fetch('/api/auth/session', { credentials: 'include' });
        if (mounted) {
          if (response.ok) {
            const data = await response.json();
            if (data.user) {
              setUser({ username: data.user.username, role: data.user.role as UserRole });
              setIsAuthenticated(true);
            }
          }
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Session restore failed:', error);
        if (mounted) setIsLoading(false);
      }
    };

    restoreSession();
    return () => { mounted = false; };
  }, []);

  const logout = () => {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(
      error => console.error('Logout API call failed:', error)
    );
    setIsAuthenticated(false);
    setUser(null);
    router.push('/login');
  };

  const role = user?.role ?? null;
  const isAdmin = role === 'admin';

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, isAdmin, role, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
