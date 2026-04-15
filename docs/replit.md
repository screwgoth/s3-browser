# S3 Navigator - Replit Project Setup

## Overview
S3 Navigator is a Next.js application that provides a web-based interface for browsing AWS S3 buckets. It includes user authentication, bucket management, and file browsing capabilities.

## Project Architecture
- **Frontend**: Next.js 15.3.3 with Tailwind CSS and Radix UI components
- **AI Integration**: Google AI Gemini 2.0 Flash model via Genkit
- **Storage**: Local storage for user and bucket configurations
- **Authentication**: Simple username/password system with admin user
- **Deployment**: Configured for Replit autoscale deployment

## Recent Changes
- 2025-09-07: Initial setup for Replit environment
  - Configured Next.js to run on port 5000 with hostname 0.0.0.0
  - Set up development workflow for frontend server
  - Configured deployment settings for production (autoscale)
  - Installed all dependencies successfully

## User Preferences
- The application uses Firebase integration and supports AI features
- Designed for AWS S3 bucket browsing and management
- Admin user management capabilities

## Development Setup
- Development server runs on port 5000
- Uses Turbopack for faster development builds
- All dependencies installed and working
- Application successfully loads with login functionality

## Deployment Configuration
- Target: Autoscale (stateless web application)
- Build command: `npm run build`
- Run command: `npm start`
- Suitable for S3 bucket browser application that doesn't need persistent state