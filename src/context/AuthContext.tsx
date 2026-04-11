
"use client";

import React, { createContext, useState, useContext, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, type User, type UserRole } from './UserContext';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  isAdmin: boolean;
  role: UserRole | null;
  login: (username: string, pass: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const { validateUser, users } = useUser();

  // Restore session from server-side cookie on mount
  useEffect(() => {
    let mounted = true;

    const restoreSession = async () => {
      try {
        const response = await fetch('/api/auth/session', {
          credentials: 'include',
        });

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
  }, []); // Only run once on mount

  const login = (username: string, pass: string) => {
    if (validateUser(username, pass)) {
      const freshUser = users.find(u => u.username === username);
      const userToStore = freshUser ?? { username, password: pass, role: 'viewer' as UserRole };
      if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.setItem === 'function') {
        window.localStorage.setItem('s3-user', JSON.stringify(userToStore));
      }
      setUser(userToStore);
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    // Destroy server-side session (fire-and-forget)
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(
      (error) => console.error('Logout API call failed:', error)
    );
    if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.removeItem === 'function') {
      window.localStorage.removeItem('s3-user');
    }
    setIsAuthenticated(false);
    setUser(null);
    router.push('/login');
  };

  const role = user?.role ?? null;
  const isAdmin = role === 'admin';

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, isAdmin, role, login, logout }}>
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
