# Changelog: feature/profile-editing Branch

## Summary

This branch adds major features to raptorsCTF including account management, email verification, container orchestration improvements, and deployment automation.

**Total Changes**: 4,022+ lines added across 23 files

## Major Features

### 1. User Account Management
**Files**: `client/src/pages/account-settings.tsx`, `server/routes/account.ts`

- ✅ Profile editing (username, email, bio)
- ✅ Password change with current password verification
- ✅ Email change with verification flow
- ✅ User settings and preferences
- ✅ Admin ability to edit any user profile

### 2. Email System
**Files**: `server/services/email.ts`, `server/routes/account.ts`

- ✅ SMTP integration with Postfix/external SMTP
- ✅ Email verification for new accounts
- ✅ Password reset via email
- ✅ Email change verification
- ✅ Customizable email templates
- ✅ Token-based security with expiration
- ⚠️ **TODO**: Add rate limiting to prevent abuse

**Security Features**:
- Secure random tokens (32 bytes)
- Hashed tokens before database storage
- Single-use tokens (deleted after use)
- Expiration time (1 hour for password reset, 24 hours for verification)
- Email enumeration protection (always returns success)

### 3. Container Management Refactor
**Files**: `nginx-container-proxy.conf`, `server/routes.ts`, `server/services/container/*`

**Breaking Changes**:
- ❌ **REMOVED**: `/challenge/{id}` routing (deprecated, auth-based)
- ✅ **NEW**: `/container/{deploymentId}` routing (no auth required)

**Why No Auth for Containers?**
- Container challenges are intentionally vulnerable applications (e.g., OWASP Juice Shop)
- They're meant to be exploited as part of CTF challenges
- Authentication adds unnecessary complexity
- Similar to how actual CTF platforms work (e.g., HackTheBox)

**Security Considerations**:
- Deployment IDs are sequential integers (can be enumerated)
- Only running deployments return valid responses
- Stopped deployments return 404
- Container port range: 30000-40000 (isolated)
- Firewall rules in place

**Implementation**:
- New nginx route: `/container/{deploymentId}`
- New backend endpoint: `/api/internal/container-port-lookup`
- No authentication required
- Simplified proxy logic
- Better support for WebSockets and API calls

### 4. Private Events
**Files**: `shared/schema.ts`, `migrations/*`

- ✅ Events can be marked as private
- ✅ Private events hidden until reveal date
- ✅ Owner/admin can always see private events
- ✅ Automatic reveal at specified time

### 5. Owner Role Hierarchy
**Files**: `shared/schema.ts`, `server/routes.ts`, `migrations/rollbacks/add_owner_role.sql`

**Permission Hierarchy**:
- **Owner**: Full platform control (promotes/demotes admins, manages all)
- **Admin**: Manage CTFs, challenges, users (cannot promote to admin)
- **User**: Participate in CTFs

**First Admin Promotion**:
- Oldest admin account is automatically promoted to owner
- Migration script in `migrations/rollbacks/add_owner_role.sql`

### 6. Deployment Automation
**Files**: `scripts/setup-production.sh`, `docs/MIGRATIONS.md`

**New Setup Script**:
- Unified installation process
- System requirements check
- Automated package installation (Node.js, PostgreSQL, Nginx, Docker, Postfix)
- SSL certificate with Let's Encrypt
- Database setup and migrations
- Systemd service creation
- Firewall configuration (UFW)
- Fail2Ban for SSH protection

**Deployment Process**:
1. Run single script: `sudo ./scripts/setup-production.sh`
2. Answer prompts (domain, email, database credentials)
3. Script handles everything automatically
4. Create admin user with `npm run db:create-admin`

## Files Changed

### New Files
- `client/src/pages/account-settings.tsx` (+384 lines) - Account settings page
- `client/src/pages/forgot-password.tsx` (+195 lines) - Password reset request
- `client/src/pages/reset-password.tsx` (+256 lines) - Password reset form
- `client/src/pages/verify-email.tsx` (+178 lines) - Email verification page
- `server/routes/account.ts` (+323 lines) - Account management API
- `server/services/email.ts` (+232 lines) - Email service
- `nginx-container-proxy.conf` (+125 lines) - Nginx proxy config
- `scripts/setup-production.sh` (+600 lines) - Production deployment script
- `docs/BRANCH_CLEANUP.md` - Branch merge preparation
- `docs/MIGRATIONS.md` - Migration guide
- `docs/CHANGELOG_FEATURE_BRANCH.md` - This file

### Modified Files
- `server/routes.ts` (+261/-8 lines) - Container routing refactor, email endpoints
- `client/src/pages/admin.tsx` (+154/-40 lines) - Admin panel improvements
- `server/storage.ts` (+63 lines) - New storage methods for email, private events
- `shared/schema.ts` (+50 lines) - New tables and columns
- `.env.example` (+13 lines) - New environment variables
- `server/services/container/container-orchestrator.ts` (+15 lines) - Service name support
- `client/src/App.tsx` (+12 lines) - New routes
- `client/src/components/layout/navbar.tsx` (+16 lines) - Account settings link
- `client/src/pages/auth-page.tsx` (+7 lines) - Forgot password link

### Migration Files
- `migrations/0001_friendly_surge.sql` - Email verification, private events schema
- `migrations/meta/0001_snapshot.json` - Schema snapshot
- `migrations/rollbacks/add_owner_role.sql` - Owner role promotion
- `migrations/rollbacks/rollback_owner_role.sql` - Owner role rollback
- `migrations/rollbacks/add_private_events.sql` - Private events rollback

## Environment Variables

### New Required Variables
```bash
# Base URL (used for emails and container access)
BASE_URL=https://ctf.example.com

# Email Configuration
SMTP_HOST=localhost
SMTP_PORT=25
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=noreply@ctf.example.com
EMAIL_FROM_NAME=CTF Platform

# Container Management
DOCKER_SOCKET=/var/run/docker.sock
CONTAINER_PORT_RANGE_MIN=30000
CONTAINER_PORT_RANGE_MAX=40000
```

## Database Schema Changes

### New Tables
- `email_verification_tokens` - Email verification tokens
- `password_reset_tokens` - Password reset tokens

### New Columns
- `users.emailVerified` - Email verification status
- `users.emailVerifiedAt` - Verification timestamp
- `users.emailVerificationToken` - Hashed verification token
- `users.bio` - User biography
- `ctfs.isPrivate` - Private event flag
- `ctfs.revealDate` - Private event reveal date

### Modified Columns
- `users.role` - Now supports 'owner', 'admin', 'user'
- `container_port_mappings.serviceName` - Service name for friendly URLs

## Breaking Changes

### 1. Container Access URLs
**Before**: `/challenge/{challengeId}`
**After**: `/container/{deploymentId}`

**Impact**: Any hardcoded links or bookmarks will break
**Migration**: URLs are automatically updated in API responses

### 2. Nginx Configuration
**Before**: `ctf-container-proxy.conf` with challenge routing
**After**: `ctf-container-proxy.conf` with container routing

**Impact**: Requires nginx config update and reload
**Migration**: Run `scripts/setup-production.sh` or manually update config

### 3. Database Migrations
**Before**: Manual SQL execution
**After**: Automated via Drizzle Kit

**Impact**: Must run `npm run db:generate && npm run db:push`
**Migration**: See `docs/MIGRATIONS.md`

## Security Review

### Addressed
✅ Removed auth from container access (intentional for CTF challenges)
✅ Email verification with secure tokens
✅ Password reset with single-use tokens
✅ Owner role for enhanced permission control
✅ Firewall rules for container port range
✅ Fail2Ban for SSH protection
✅ Email enumeration protection

### TODO
⚠️ Add rate limiting to email endpoints
⚠️ Add CAPTCHA to registration/password reset
⚠️ Consider UUID-based deployment IDs (more secure than sequential)
⚠️ Add container access logging/analytics
⚠️ Implement container health checks

## Testing Checklist

Before merging to main:

- [ ] Test email verification flow
- [ ] Test password reset flow
- [ ] Test email change flow
- [ ] Test profile editing
- [ ] Test container deployment and access
- [ ] Test container routing (`/container/{id}`)
- [ ] Test admin panel container links
- [ ] Test private events visibility
- [ ] Test owner role permissions
- [ ] Test fresh database migration
- [ ] Test deployment script on clean Ubuntu 22.04/24.04
- [ ] Test SSL certificate acquisition
- [ ] Test email delivery (Postfix)
- [ ] Test firewall rules
- [ ] Verify all environment variables work

## Deployment Guide

### For New Installations

1. **Clone repository**
   ```bash
   git clone <repo> raptorsCTF
   cd raptorsCTF
   git checkout feature/profile-editing
   ```

2. **Run setup script**
   ```bash
   sudo ./scripts/setup-production.sh
   ```

3. **Create admin user**
   ```bash
   npm run db:create-admin
   ```

4. **Configure DNS**
   - Point domain to server IP
   - Wait for DNS propagation

5. **Test email**
   ```bash
   echo "Test" | mail -s "Test" your@email.com
   ```

### For Existing Installations

1. **Backup database**
   ```bash
   pg_dump -U ctf_admin ctf_platform > backup_$(date +%Y%m%d).sql
   ```

2. **Pull changes**
   ```bash
   git checkout feature/profile-editing
   git pull origin feature/profile-editing
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Run migrations**
   ```bash
   npm run db:generate
   npm run db:push
   ```

5. **Update environment**
   ```bash
   # Add new variables to .env (see above)
   ```

6. **Update nginx config**
   ```bash
   sudo cp nginx-container-proxy.conf /etc/nginx/sites-available/ctf-platform.conf
   sudo nginx -t
   sudo systemctl reload nginx
   ```

7. **Rebuild and restart**
   ```bash
   npm run build
   sudo systemctl restart ctf-platform
   ```

8. **Verify deployment**
   ```bash
   curl https://your-domain.com/api/health
   journalctl -u ctf-platform -n 50
   ```

## Rollback Procedures

If issues are encountered:

1. **Restore database**
   ```bash
   psql -U ctf_admin ctf_platform < backup_20250101.sql
   ```

2. **Checkout previous branch**
   ```bash
   git checkout main
   npm install
   npm run build
   sudo systemctl restart ctf-platform
   ```

3. **Restore nginx config**
   ```bash
   # Restore previous nginx config from backup
   sudo systemctl reload nginx
   ```

## Known Issues

1. **Email delivery**: Requires proper SPF/DKIM setup for deliverability
2. **Container enumeration**: Deployment IDs are sequential (consider UUIDs in future)
3. **No rate limiting**: Email endpoints should have rate limiting
4. **Manual owner promotion**: First admin must be manually promoted to owner

## Future Improvements

- [ ] Add rate limiting middleware
- [ ] Add CAPTCHA support
- [ ] UUID-based deployment IDs
- [ ] Container access logging
- [ ] Container health monitoring
- [ ] Container auto-scaling
- [ ] Email delivery monitoring
- [ ] Admin notification system
- [ ] Audit log for sensitive actions
- [ ] Two-factor authentication (2FA)

## Contributors

- Liam Luthor

## License

Same as main project
