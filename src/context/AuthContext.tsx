
"use client";

import React, { createContext, useState, useContext, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, type User } from './UserContext';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  login: (username: string, pass: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const { validateUser } = useUser();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storage = window.localStorage;
        if (storage && typeof storage.getItem === 'function') {
          const storedUser = storage.getItem('s3-user');
          if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            if (validateUser(parsedUser.username, parsedUser.password)) {
              setUser(parsedUser);
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
      const userToStore = { username, password: pass };
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

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, login, logout }}>
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
