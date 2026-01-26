# Committee Management System (Comités Distritales)

## Overview

A multi-tenant web application for managing roles and attendance for district committees (Comités Distritales). The system allows multiple independent committees to manage internal roles (president, secretary, counselor, etc.), organize attendance by date and shift, and visualize calendars and roles in a centralized platform.

**Current Status**: MVP Complete - All core features implemented and tested

Key features:
- Multi-committee architecture with isolated data per committee
- Role-based membership management (admin, president, secretary, counselor, member)
- Attendance scheduling with morning/afternoon/full-day shifts
- Calendar visualization for attendance slots
- User profiles with committee membership tracking
- Spanish language localization
- Dark/light mode theme support

## Security Features

- Multi-tenant data isolation: All API endpoints verify user membership before returning committee data
- Admin-only operations: Only admins can create attendance slots and manage members
- Duplicate registration prevention: Database-level unique constraint prevents double-booking
- User ownership verification: Users can only cancel their own attendance records

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom theme configuration supporting light/dark modes
- **Design Pattern**: Productivity-focused design system inspired by Linear/Notion

The frontend follows a standard SPA structure with:
- App shell layout with fixed sidebar navigation (240px)
- Protected routes requiring authentication
- Landing page for unauthenticated users
- Pages: Dashboard, Committees, Calendar, Attendances, Members, Profile, Settings

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Design**: RESTful JSON API under `/api/*` routes
- **Authentication**: Replit Auth integration using OpenID Connect with Passport.js
- **Session Management**: PostgreSQL-backed sessions via connect-pg-simple

The server uses a clean separation:
- `server/routes.ts`: API endpoint definitions with authorization checks
- `server/storage.ts`: Database abstraction layer implementing `IStorage` interface
- `server/db.ts`: Drizzle ORM database connection

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` (shared between client and server)
- **Migrations**: Managed via drizzle-kit with output to `./migrations`

Core entities:
- `users`: Authentication users (required for Replit Auth)
- `sessions`: Session storage (required for Replit Auth)
- `committees`: Committee organizations with configurable schedules
- `committee_members`: User-committee relationships with roles
- `attendance_slots`: Scheduled time slots for attendance
- `attendances`: User attendance records for slots

### Build System
- **Development**: Vite dev server with HMR, proxied through Express
- **Production**: Vite builds client to `dist/public`, esbuild bundles server to `dist/index.cjs`
- **TypeScript**: Strict mode with path aliases (`@/*` for client, `@shared/*` for shared)

## External Dependencies

### Database
- PostgreSQL database (connection via `DATABASE_URL` environment variable)
- Drizzle ORM for type-safe database operations
- drizzle-zod for schema validation

### Authentication
- Custom email/password authentication with Passport.js local strategy
- Password hashing: bcrypt with 12 salt rounds
- Session management: PostgreSQL-backed sessions via connect-pg-simple
- Required environment variable: `SESSION_SECRET`, `DATABASE_URL`

### Third-Party Libraries
- **UI**: Radix UI primitives, Lucide icons, class-variance-authority
- **Forms**: React Hook Form with Zod validation
- **Dates**: date-fns with Spanish locale support
- **HTTP**: Native fetch API wrapped in queryClient utilities

### Replit-Specific Integrations
- `@replit/vite-plugin-runtime-error-modal`: Development error overlay
- `@replit/vite-plugin-cartographer`: Development tooling
- `@replit/vite-plugin-dev-banner`: Development environment indicator

## Activity Assignment System

Activities can be assigned to specific members or all members of a committee/team:
- When creating an activity, choose assignment mode: none, all members, or specific members
- Assigned members receive push notifications about the new activity
- Assignment data stored in `activity_assignments` table

## Subdomain Configuration (Future Feature)

To implement per-counselor subdomains (e.g., counselor1.comite.dovexmx.com), the following VPS configuration is required:

### 1. DNS Configuration
Add a wildcard A record in your DNS provider:
```
*.comite.dovexmx.com -> VPS_IP_ADDRESS
```

### 2. Nginx Wildcard SSL Certificate
Use Certbot with DNS challenge to get wildcard certificate:
```bash
sudo certbot certonly --manual --preferred-challenges=dns -d "*.comite.dovexmx.com" -d "comite.dovexmx.com"
```

### 3. Nginx Configuration Update
Update `/etc/nginx/conf.d/comite.dovexmx.com.conf`:
```nginx
server {
    listen 443 ssl;
    server_name *.comite.dovexmx.com comite.dovexmx.com;
    
    ssl_certificate /etc/letsencrypt/live/comite.dovexmx.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/comite.dovexmx.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Subdomain $subdomain;
    }
    
    # Extract subdomain
    set $subdomain "";
    if ($host ~* ^([^.]+)\.comite\.dovexmx\.com$) {
        set $subdomain $1;
    }
}
```

### 4. Backend Subdomain Detection
Add middleware to detect subdomain and filter data:
```typescript
app.use((req, res, next) => {
  const subdomain = req.get('X-Subdomain') || '';
  req.counselorSubdomain = subdomain;
  next();
});
```

### 5. Database Changes
Add `subdomain` field to counselor teams table to map subdomains to teams.

## Push Notifications

### Action Buttons Limitation
- **Android Chrome**: Full support for notification action buttons (Confirm, +5 min, +15 min)
- **iOS Safari/PWA**: Does NOT support notification action buttons - this is an Apple platform limitation
- iOS users must open the app to confirm/snooze notifications

### VAPID Keys Configuration
VAPID keys must be configured in ecosystem.config.cjs for PM2 on VPS:
```javascript
env: {
  VAPID_PUBLIC_KEY: "your_public_key",
  VAPID_PRIVATE_KEY: "your_private_key"
}
```