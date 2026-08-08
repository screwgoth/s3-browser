"use client";

// All user management is handled by the server-side API (/api/users).
// This file exists only to export shared types used across the app.
export type UserRole = 'viewer' | 'uploader' | 'bucket-creator' | 'admin';

export interface User {
  username: string;
  role: UserRole;
}
