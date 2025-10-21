# Overview

Ilumina is a smart contract analysis and simulation platform that helps developers test and verify blockchain applications before deployment. The platform analyzes GitHub repositories containing smart contracts, generates deployment scripts, creates test scenarios with actors and actions, and runs simulations to validate contract behavior. It provides AI-powered code reviews, real-time chat assistance, and detailed analysis reports to help identify potential issues early in the development cycle.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**Problem**: Need an interactive, responsive UI for managing smart contract analysis workflows
**Solution**: React-based SPA with TypeScript using Wouter for routing and TanStack Query for state management
**Rationale**: 
- React provides component reusability and efficient rendering
- TypeScript ensures type safety across the application
- Wouter offers lightweight client-side routing
- TanStack Query handles server state synchronization and caching

**Key Components**:
- **Layout System**: RootLayout component wraps all pages with consistent navigation and authentication context
- **Protected Routes**: ProtectedRoute component ensures authentication before accessing sensitive pages
- **Analysis Dashboard**: Real-time status updates for analysis steps with collapsible sections
- **Code Viewer**: Syntax-highlighted code display with inline review comments
- **Chat Assistant**: Context-aware AI assistant for project-specific questions
- **Form Handling**: React Hook Form with Zod validation for type-safe form submissions

## Backend Architecture

**Problem**: Need to orchestrate complex analysis workflows involving external AI services and database operations
**Solution**: Express.js server with TypeScript, session-based authentication, and RESTful API design
**Rationale**:
- Express provides flexible middleware system for request handling
- Session-based auth with Passport.js enables stateful authentication
- RESTful endpoints align with frontend query patterns
- TypeScript ensures type consistency between frontend and backend

**Key Services**:
- **Authentication**: Passport.js with local strategy using scrypt password hashing
- **External API Integration**: Communicates with Ilumina AI service for analysis execution
- **Email Service**: Nodemailer for transactional emails (registration, password reset)
- **AI Chat**: Google Gemini API integration for contextual assistance
- **File Management**: GitHub API integration for repository analysis

## Database Schema

**Problem**: Need to track projects, analysis submissions, team collaboration, and user subscriptions
**Solution**: PostgreSQL with Drizzle ORM for type-safe database operations
**Rationale**:
- PostgreSQL provides ACID compliance and complex query support
- Drizzle ORM generates TypeScript types from schema definitions
- Neon serverless driver enables connection pooling

**Core Tables**:
- **users**: User accounts with plan information (free, lite, pro, teams)
- **projects**: GitHub repositories linked to users or teams
- **submissions**: Analysis job tracking with status and metadata
- **teams**: Team collaboration with role-based access
- **team_members**: User-team relationships with invitation status
- **chat_messages**: Persistent chat history for AI assistant
- **analysis_steps**: Granular tracking of analysis workflow progress
- **simulation_runs**: Results from contract simulation executions

**Design Decisions**:
- Soft deletes on teams (isDeleted flag) to preserve historical data
- JSON fields for flexible metadata storage (step_metadata, analysis data)
- Composite primary keys for junction tables (team_members)
- Timestamp tracking for audit trails (createdAt, updatedAt)

## External Dependencies

**Third-Party Services**:

1. **Ilumina AI Service** (`https://ilumina-wf-tt2cgoxmbq-uc.a.run.app/api`)
   - Purpose: External analysis engine for smart contract evaluation
   - Integration: REST API with Bearer token authentication
   - Key Endpoints: `/begin_analysis`, `/submission/{id}/history`, `/action-statuses`
   - Environment Variables: `ILUMINA_API_BASE_URL`, `ILUMINA_API_KEY`

2. **Google Gemini API** (`@google/generative-ai`)
   - Purpose: AI-powered chat assistance and code analysis
   - Model: gemini-2.0-flash for chat, classification, and content generation
   - Features: Request classification, conversation context management, checklist generation
   - Environment Variable: `GEMINI_API_KEY`

3. **GitHub API**
   - Purpose: Repository content access for code analysis
   - Integration: Direct REST API calls for file contents and metadata
   - No authentication token required for public repositories

4. **Email Service** (Nodemailer)
   - Purpose: Transactional email delivery
   - Providers: SMTP configuration for registration, password reset, team invitations
   - Environment Variables: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `NOREPLY_EMAIL`, `NOREPLY_PASS`

5. **Neon Database** (`@neondatabase/serverless`)
   - Purpose: Serverless PostgreSQL hosting
   - Features: WebSocket connections, connection pooling
   - Environment Variable: `DATABASE_URL`

**UI Component Library**:
- Radix UI primitives for accessible components
- Tailwind CSS for styling with custom theme configuration
- shadcn/ui component patterns

**Development Tools**:
- Vite for fast development server and build optimization
- Drizzle Kit for database migrations
- ESBuild for server bundle production builds

**Authentication & Session Management**:
- express-session with PostgreSQL store
- connect-pg-simple for session persistence
- Crypto module (scrypt) for secure password hashing

**State Management**:
- TanStack Query for server state caching and synchronization
- React Context for authentication state
- Local state with React hooks for UI interactions