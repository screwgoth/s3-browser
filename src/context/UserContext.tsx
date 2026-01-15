
"use client";

import React, { createContext, useState, useContext, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface User {
  username: string;
  password?: string; // Should be hashed in a real app
}

interface UserContextType {
  users: User[];
  addUser: (username: string, pass: string) => boolean;
  updateUser: (username: string, pass: string) => void;
  deleteUser: (username: string) => void;
  validateUser: (username: string, pass: string) => boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const defaultUsers: User[] = [
  { username: 'admin', password: 's3brows3r' }
];

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storage = window.localStorage;
        if (storage && typeof storage.getItem === 'function') {
          const storedUsers = storage.getItem('s3-users');
          if (storedUsers) {
            const parsedUsers = JSON.parse(storedUsers);
            // Ensure admin user always exists
            const adminExists = parsedUsers.some((u: User) => u.username === 'admin');
            if (!adminExists) {
              setUsers([...defaultUsers, ...parsedUsers.filter((u: User) => u.username !== 'admin')]);
            } else {
              setUsers(parsedUsers);
            }
          } else {
            setUsers(defaultUsers);
          }
        } else {
          setUsers(defaultUsers);
        }
      } catch (e) {
        console.error("Failed to load users from localStorage", e);
        setUsers(defaultUsers);
      }
    } else {
      setUsers(defaultUsers);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded && typeof window !== 'undefined') {
      try {
        const storage = window.localStorage;
        if (storage && typeof storage.setItem === 'function') {
          storage.setItem('s3-users', JSON.stringify(users));
        }
      } catch (e) {
        console.error("Failed to save users to localStorage", e);
      }
    }
  }, [users, isLoaded]);

  const addUser = (username: string, pass: string) => {
    if (users.some(u => u.username === username)) {
      toast({ variant: 'destructive', title: 'Error', description: 'User already exists.' });
      return false;
    }
    setUsers(prev => [...prev, { username, password: pass }]);
    toast({ title: 'Success', description: `User "${username}" added.` });
    return true;
  };

  const updateUser = (username: string, pass: string) => {
    setUsers(prev => prev.map(u => u.username === username ? { ...u, password: pass } : u));
    toast({ title: 'Success', description: `Password for "${username}" updated.` });
  };

  const deleteUser = (username: string) => {
    if (username === 'admin') {
      toast({ variant: 'destructive', title: 'Error', description: 'Cannot delete admin user.' });
      return;
    }
    setUsers(prev => prev.filter(u => u.username !== username));
    toast({ title: 'Success', description: `User "${username}" deleted.` });
  };

  const validateUser = (username: string, pass: string) => {
    const user = users.find(u => u.username === username);
    return !!user && user.password === pass;
  };

  return (
    <UserContext.Provider value={{ users, addUser, updateUser, deleteUser, validateUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
