# Branch Cleanup Plan: feature/profile-editing → main

## Security Review

### 1. Container Routing Security Analysis

**Current Situation:**
- ✅ NEW: `/container/{deploymentId}` - No auth required (intended for CTF challenges)
- ⚠️ OLD: `/challenge/{id}` - Auth required via nginx subrequest (DEPRECATED)

**Security Implications:**
- **Containers are intentionally public**: CTF challenge containers (like Juice Shop) are vulnerable applications meant to be exploited. No auth is appropriate.
- **Deployment IDs are sequential integers**: Anyone can enumerate `/container/1`, `/container/2`, etc.
  - This is acceptable because:
    - Only running deployments return valid responses
    - Stopped deployments return 404
    - The containers themselves are meant to be publicly accessible CTF challenges
  - **Alternative considered**: Use UUIDs instead of sequential IDs for deployments (more secure but adds complexity)

**Recommendation**:
- ✅ Keep `/container/{deploymentId}` as-is (no auth)
- ⚠️ Remove deprecated `/challenge/` routing code
- ⚠️ Remove `challenge-proxy-auth` endpoint (no longer used)
- ⚠️ Update admin panel to show `/container/` URLs only

### 2. Files with Deprecated Code to Clean Up

#### server/routes.ts
- Lines 1568-1570: Admin deployment list returns old `/challenge/{id}` URLs
- Lines 1931-2048: `challenge-proxy-auth` endpoint (deprecated, not used by nginx anymore)
- Lines 2050-2144: Legacy path-based challenge proxy endpoint (deprecated)

#### nginx-container-proxy.conf
- No deprecated code - this file only has the new `/container/` route

### 3. Other Security Concerns in Branch

**Email Verification System** (new in this branch):
- ✅ Uses secure tokens with expiration
- ✅ Tokens are hashed before storage
- ✅ Rate limiting considerations needed (TODO)

**Password Reset System** (new in this branch):
- ✅ Uses secure tokens with expiration
- ✅ Tokens are single-use (deleted after use)
- ✅ Email enumeration protection (always returns success message)

**Profile Editing** (new in this branch):
- ✅ Requires authentication
- ✅ Users can only edit own profile
- ✅ Admins can edit any profile
- ⚠️ Email change requires verification (good)

## Deployment Infrastructure Consolidation

### Current State
Multiple scattered setup scripts and docs:
- `/setup-container-proxy.sh` - Container proxy setup
- Various manual setup instructions in docs
- No unified deployment process
- Migration system is manual

### Proposed Solution: Unified Setup Script

Create `scripts/setup-production.sh` that:

1. **System Requirements Check**
   - OS: Ubuntu 22.04/24.04
   - Architecture: x86_64
   - Root access required
   - Ports 80, 443, 5432 available

2. **Package Installation**
   - Node.js 20 LTS
   - PostgreSQL 16
   - Nginx
   - Docker (for containers)
   - Certbot (for SSL)
   - Postfix (for email)

3. **PostgreSQL Setup**
   - Create database and user
   - Secure configuration
   - Run migrations automatically

4. **Email Setup (Postfix)**
   - Configure as send-only relay
   - SPF/DKIM guidance
   - Test email delivery

5. **Nginx Setup**
   - Install configuration
   - Setup SSL with Let's Encrypt
   - Configure container proxy

6. **Application Setup**
   - Clone repository
   - Install dependencies
   - Build application
   - Create systemd service
   - Create initial admin user

7. **Docker Setup** (for containers)
   - Install Docker
   - Configure permissions
   - Setup docker socket access

8. **Security Hardening**
   - Firewall rules (ufw)
   - Fail2ban for SSH
   - Secure file permissions
   - Regular update reminders

### Migration System Fix

**Current Problems:**
- Manual SQL file execution
- No version tracking
- Rollback files in wrong location
- No automated migration runner

**Proposed Solution:**
- Use Drizzle Kit's built-in migration system properly
- Remove manual SQL files from `/migrations/` root
- Use `drizzle-kit push` for development
- Use `drizzle-kit migrate` for production
- Track migration state in database

## Changes to Review Before Merge

### Major Features Added (4,022+ lines)
1. ✅ **Account Settings Page** - Profile editing, password change
2. ✅ **Email System** - SMTP integration, verification, password reset
3. ✅ **Container Management** - Full Docker orchestration
4. ✅ **Private Events** - Event visibility controls
5. ✅ **Owner Role** - Enhanced permission hierarchy

### Files with Most Changes
1. `server/routes.ts` (+261 lines) - Email endpoints, container endpoints
2. `server/routes/account.ts` (+323 lines) - New account management routes
3. `server/services/email.ts` (+232 lines) - New email service
4. `client/src/pages/account-settings.tsx` (+384 lines) - New settings page
5. `migrations/meta/0001_snapshot.json` (+1597 lines) - Schema snapshot

### Potential Issues to Address
- [ ] Remove deprecated challenge routing code
- [ ] Update admin panel URLs to use `/container/`
- [ ] Add rate limiting to email endpoints
- [ ] Test migration system on fresh database
- [ ] Update documentation for new deployment process
- [ ] Add environment variable validation
- [ ] Create migration guide for existing deployments

## Action Items

### Immediate (Before Merge)
1. Remove deprecated `/challenge/` routing code from routes.ts
2. Update admin panel to show `/container/` URLs
3. Test all features work with new routing
4. Review and test migration files
5. Update .env.example with all new variables

### Short Term (After Merge)
1. Create unified `scripts/setup-production.sh`
2. Write deployment documentation
3. Add rate limiting middleware
4. Create migration guide for existing installations
5. Add automated testing for deployment process

### Long Term
1. Consider UUID-based deployment IDs for better security
2. Add container access logging/analytics
3. Implement container auto-scaling
4. Add health checks for deployed containers
5. Create container template marketplace
