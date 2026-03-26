
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storage = window.localStorage;
        if (storage && typeof storage.getItem === 'function') {
          const storedUser = storage.getItem('s3-user');
          if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            if (validateUser(parsedUser.username, parsedUser.password)) {
              // Re-hydrate role from UserContext (source of truth)
              const freshUser = users.find(u => u.username === parsedUser.username);
              const userWithRole = freshUser ?? parsedUser;
              setUser(userWithRole);
              setIsAuthenticated(true);
            } else {
              // Stored credentials are no longer valid
              storage.removeItem('s3-user');
            }
          }
        }
      } catch (error) {
        console.error("Could not parse user from localStorage", error);
      }
    }
    setIsLoading(false);
  }, [validateUser]);

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
