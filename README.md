# raptorsCTF Platform

A competitive Capture The Flag platform built with React, Express, and PostgreSQL.

---

## 1. Overview

### Tech Stack

**Frontend:**
- React 19 with TypeScript
- Vite for build tooling
- TanStack Query (React Query) for data fetching
- Recharts for analytics and leaderboards
- Tailwind CSS + shadcn/ui components

**Backend:**
- Node.js 20+ with Express
- PostgreSQL 14+ with Drizzle ORM
- Session-based authentication
- Docker for container orchestration

**Infrastructure:**
- Nginx for reverse proxy and SSL termination
- Process management: Systemd (production-tested) or PM2
- Email delivery: AWS SES (production-tested), Sendmail, or Postfix with external SMTP

### Requirements & Dependencies

**System Requirements:**
- Node.js 20 or higher
- PostgreSQL 14 or higher
- Docker (optional - for containerized challenges)
- Ubuntu Server (recommended for production)

**Node.js Dependencies:**
All dependencies are managed via npm and listed in `package.json`. Key dependencies include:
- Express, Drizzle ORM, Postgres driver
- React, React Router, TanStack Query
- Helmet, express-rate-limit (security)
- Nodemailer (email delivery)

### Features

**CTF Management:**
- Multi-CTF event management with configurable timelines
- Private events with invite codes for exclusive competitions
- Team-based and individual competition modes
- Dynamic and static scoring systems
- First blood recognition

**Challenge System:**
- Challenge categories: Web, Crypto, Pwn, Reverse, Forensics, Misc, OSINT
- Markdown support for challenge descriptions with XSS protection
- File attachments for challenges
- Flag submission and validation

**Container Orchestration:**
- Built-in Docker container management
- Deploy challenge infrastructure (web servers, services, vulnerable apps)
- Subdomain-based routing to containers
- Resource limits and lifecycle management

**User Management:**
- Owner/Admin/User role hierarchy
- Protected platform ownership with multi-admin support
- Team creation and management
- User profiles and statistics

**Analytics & Leaderboards:**
- Real-time leaderboard with graphs
- Solve statistics and first blood tracking
- Team rankings and individual scores

**Admin Dashboard:**
- Complete CTF, challenge, and user management
- Container deployment and monitoring
- Platform settings and configuration

---

## 2. Installation

### Quick Start

1. **Clone the repository and install dependencies:**
   ```bash
   git clone <repository-url>
   cd ctf_platform
   npm install
   ```

2. **Copy the example environment file:**
   ```bash
   cp .env.example .env
   ```

3. **Configure your environment** (see Configuration section below)

4. **Run setup to create the database:**
   ```bash
   ./setup.sh
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```

The platform will be available at `http://localhost:5001`

### Helper Scripts

**setup.sh** - Initial database setup
- Creates PostgreSQL database
- Runs all migrations
- Creates initial admin user from `.env` credentials

**Database Management:**
```bash
# Run migrations
npm run db:migrate

# Generate migration from schema changes
npm run db:generate

# Push schema changes directly (development only)
npm run db:push

# Create admin user
npm run db:create-admin

# Seed database with test data
npm run db:seed
```

**Build and Run:**
```bash
# Development server with hot reload
npm run dev

# Production build
npm run build

# Start production server
npm run start

# Type checking
npm run check
```

### Database Setup

**Manual PostgreSQL Setup:**

1. **Install PostgreSQL:**
   ```bash
   sudo apt update
   sudo apt install postgresql postgresql-contrib -y
   ```

2. **Create database and user:**
   ```bash
   sudo -u postgres psql
   ```

   In the PostgreSQL prompt:
   ```sql
   CREATE USER ctf_user WITH PASSWORD 'your_secure_password';
   CREATE DATABASE ctf_platform OWNER ctf_user;
   GRANT ALL PRIVILEGES ON DATABASE ctf_platform TO ctf_user;
   \q
   ```

3. **Update `.env` with database credentials:**
   ```bash
   DATABASE_URL=postgresql://ctf_user:your_secure_password@localhost:5432/ctf_platform
   ```

4. **Run migrations:**
   ```bash
   npm run db:migrate
   ```

**Database Migrations:**

If you're upgrading from a previous version, you may need to run specific migrations:
- **Owner Role Migration**: See [MIGRATION_OWNER_ROLE.md](MIGRATION_OWNER_ROLE.md) for upgrading your first admin to owner role

### Nginx Configuration

#### Basic Setup (Development/Testing)

For simple HTTP access without containers:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Production Setup with SSL

1. **Install Certbot:**
   ```bash
   sudo apt install certbot python3-certbot-nginx -y
   ```

2. **Obtain SSL certificate:**
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

3. **Nginx configuration with SSL:**
   ```nginx
   # HTTP redirect to HTTPS
   server {
       listen 80;
       server_name your-domain.com;
       return 301 https://$server_name$request_uri;
   }

   # HTTPS configuration
   server {
       listen 443 ssl http2;
       server_name your-domain.com;

       ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

       location / {
           proxy_pass http://127.0.0.1:5001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

4. **Enable the site:**
   ```bash
   sudo ln -s /etc/nginx/sites-available/ctf /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

#### Wildcard Subdomain Configuration (For Containers)

To enable subdomain-based container routing (e.g., `whamazon.yourdomain.com`):

1. **DNS Setup:**
   - Add wildcard DNS record: `*.yourdomain.com` → your server IP

2. **Use the provided template:**
   ```bash
   cp nginx-wildcard-containers.conf.template /etc/nginx/sites-available/wildcard-containers
   ```

3. **Replace placeholders:**
   ```bash
   sudo sed -i 's/YOUR_DOMAIN/your-domain.com/g' /etc/nginx/sites-available/wildcard-containers
   ```

4. **Enable and reload:**
   ```bash
   sudo ln -s /etc/nginx/sites-available/wildcard-containers /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

**Template features:**
- SSL termination for all subdomains
- Dynamic backend port lookup
- WebSocket support
- Custom 404/502 error pages

---

## 3. Configuration

### .env Configuration

Copy `.env.example` to `.env` and configure the following:

**Database:**
```bash
DATABASE_URL=postgresql://ctf_user:changeme_ctf_password@localhost:5432/ctf_platform
```

**Session Security:**
```bash
# Generate with: openssl rand -hex 32
SESSION_SECRET=your_random_64_character_hex_string
```

**Admin Bootstrap:**
```bash
# Initial admin account created on first run
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme_immediately
```

**Application Settings:**
```bash
PORT=5001
NODE_ENV=production
```

**Container Management:**
```bash
DOCKER_ENABLED=true
DOCKER_SOCKET=/var/run/docker.sock
CONTAINER_PORT_RANGE_MIN=30000
CONTAINER_PORT_RANGE_MAX=40000
CONTAINER_ACCESS_BASE_URL=https://your-domain.com
```

**File Uploads:**
```bash
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=52428800  # 50MB in bytes
CONTAINER_UPLOAD_DIR=./uploads/containers
MAX_CONTAINER_SIZE=2147483648  # 2GB in bytes
```

**Email (Optional):**
```bash
SMTP_HOST=localhost
SMTP_PORT=25
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME="raptorsCTF Platform"
```

**Docker Registry (Optional):**
```bash
# Only needed for private registries or to avoid rate limits
DOCKER_REGISTRY_URL=https://index.docker.io/v1/
DOCKER_REGISTRY_USERNAME=your_dockerhub_username
DOCKER_REGISTRY_PASSWORD=your_dockerhub_password_or_token
```

### Owner User Setup

The platform uses a three-tier role system: **Owner → Admin → User**

**Initial Setup (First Run):**

When you run `./setup.sh`, an admin account is automatically created using credentials from `.env`:
```bash
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme_immediately
```

**Promote Admin to Owner:**

After setup, promote your admin to owner status:

```bash
npm run db:create-owner
```

Or manually via PostgreSQL:
```bash
sudo -u postgres psql ctf_platform
UPDATE users SET role = 'owner' WHERE username = 'admin';
```

**Role Hierarchy:**

- **Owner**: Full platform control, can create/delete admins, cannot be demoted
- **Admin**: CTF/challenge/user management, cannot manage other admins
- **User**: Participate in CTFs, submit flags, join teams

**Security Notes:**
- Only ONE owner account is allowed
- Owner cannot be deleted or demoted
- Owner must manually promote other admins
- Change default password immediately after first login

---

## 4. Platform Operation

### Creating/Deleting a CTF Event

**Creating a CTF:**

1. Log in as Admin or Owner
2. Navigate to **Admin Dashboard** → **CTF Events** tab
3. Click **"New CTF"** button
4. Fill in the form:
   - **Name**: Event name (e.g., "Fall 2024 CTF")
   - **Description**: Event details (supports plain text)
   - **Rules**: Competition rules (supports plain text)
   - **Start Time**: Date and time picker for event start
   - **End Time**: Date and time picker for event end
   - **Team-based**: Toggle for team vs. individual mode
   - **Max Team Size**: If team-based, set maximum members per team
   - **Published**: Toggle to make event visible to users
   - **Private**: Toggle to require invite code for registration
5. Click **"Create CTF"**

**Editing a CTF:**

- Click **"Edit"** button on any CTF event
- Modify fields as needed
- Click **"Save Changes"**

**Deleting a CTF:**

- Click **"Delete"** button on a CTF event
- Confirm deletion in the dialog
- **Warning**: This will delete all associated challenges and submissions

**Managing Invite Codes (Private Events):**

For private CTFs:
1. Edit the CTF event
2. Enable **"Private"** toggle
3. Share the auto-generated invite code with participants
4. Users must enter the code during registration

### Creating/Deleting a Challenge

**Creating a Challenge:**

1. Navigate to **Admin Dashboard** → **Challenges** tab
2. Click **"New Challenge"** button
3. Fill in the form:
   - **CTF Event**: Select which event this challenge belongs to
   - **Category**: Web, Crypto, Pwn, Reverse, Forensics, Misc, OSINT
   - **Name**: Challenge title
   - **Description**: Challenge details (supports Markdown)
   - **Flag**: The correct flag value (e.g., `flag{example}`)
   - **Points**: Static point value (or minimum if dynamic)
   - **Dynamic Scoring**: Toggle for decreasing points per solve
     - **Min Points**: Minimum points after maximum solves
     - **Decay**: Point reduction per solve
   - **Hidden**: Toggle to hide challenge until you're ready
4. Click **"Create Challenge"**

**Adding Files to Challenges:**

1. Click the **Files icon** next to a challenge
2. Click **"Upload File"**
3. Select file(s) (max 50MB per file)
4. Files appear as download links for users

**Linking Containers to Challenges:**

1. Edit a challenge
2. In **"Linked Containers"** section:
   - Select a deployed container from dropdown
   - Click to add
3. Container access info appears on challenge page
4. First linked container is marked as "Primary"

**Deleting a Challenge:**

- Click **"Delete"** button on a challenge
- Confirm deletion in the dialog
- **Note**: Submissions and solves are also deleted

### Creating/Deploying/Deleting Containers

**Prerequisites:**

1. Docker installed and running
2. User has Docker socket access (added to `docker` group)
3. Environment variables configured in `.env`

**Creating a Container:**

1. Navigate to **Admin Dashboard** → **Containers** tab
2. Click **"Add Container"** button
3. Choose deployment type:

   **Option A: Registry Pull**
   - **Image Name**: e.g., `nginx`, `strayerraptors/whamazon-react`
   - **Image Tag**: e.g., `latest`, `v1.0`
   - **Registry URL**: Leave empty for Docker Hub
   - **Registry Username/Password**: For private registries

   **Option B: Upload**
   - **Upload File**: Select a `.tar` Docker image file (max 2GB)
   - Image is saved to `uploads/containers/`

4. **Configure Ports:**
   - **Container Port**: Port exposed inside container (e.g., 80)
   - **Subdomain**: Unique subdomain for access (e.g., `whamazon`)
   - Click **"Add Port"** for multiple ports
   - **Note**: Each subdomain must be unique across all deployments

5. **Resource Limits:**
   - **Memory Limit**: 128-4096 MB (default: 512 MB)
   - **CPU Limit**: 128-2048 shares (default: 256)

6. Click **"Create"**
   - Container is automatically deployed
   - Accessible at `https://subdomain.yourdomain.com`
   - If deployment fails, container definition is automatically deleted

**Container Lifecycle:**

The container is automatically deployed on creation. Manage it from the **Active Deployments** table:

- **View Logs**: Click logs icon to see container output
- **Restart**: Restart a running container
- **Stop**: Stop a running container (frees resources)

**Deleting a Container:**

1. Locate container in **Containers** table
2. Click **"Delete"** button
3. Confirm deletion
   - Stops and removes all deployments
   - Removes port mappings
   - Deletes container definition

**Container Access:**

Containers are accessible via their configured subdomains:
- Single port: `https://whamazon.yourdomain.com`
- Multiple ports:
  - `https://whamazon.yourdomain.com` (port 5000)
  - `https://whamazon-admin.yourdomain.com` (port 3000)

**Refreshing Container Images:**

For registry-based containers:
1. Click **"Refresh Image"** button
2. System pulls latest image from registry
3. Existing deployments are stopped
4. Manually recreate container to deploy updated image

**Monitoring Containers:**

The **Docker Containers** tab shows:
- All running Docker containers on the host
- Orphaned containers (running but not tracked in database)
- Click **"Cleanup Orphans"** to remove untracked containers

### Markdown/Text/Link Support in Description Components

**Challenge Descriptions:**

Challenge descriptions support full Markdown formatting with XSS protection. See [MARKDOWN_GUIDE.md](MARKDOWN_GUIDE.md) for complete syntax guide.

**Supported Markdown Features:**

- **Headers**: `# H1`, `## H2`, `### H3`, etc.
- **Bold**: `**bold text**`
- **Italic**: `*italic text*`
- **Links**: `[Link Text](https://example.com)`
- **Code**: `` `inline code` `` and triple-backtick code blocks
- **Lists**: Ordered (`1. Item`) and unordered (`- Item`)
- **Blockquotes**: `> Quote text`
- **Images**: `![Alt text](https://example.com/image.png)`
- **Tables**: GitHub-flavored markdown tables

**Example Challenge Description:**

```markdown
# SQL Injection Challenge

Can you extract the admin password from this vulnerable login form?

## Hints
- Try different SQL payloads
- Look for error messages
- Consider blind injection techniques

## Resources
- [SQL Injection Cheat Sheet](https://portswigger.net/web-security/sql-injection/cheat-sheet)

## Flag Format
`flag{extracted_password}`
```

**Security:**

- All HTML is sanitized to prevent XSS
- Only safe Markdown elements are allowed
- External links open in new tabs
- Image sources are validated

**CTF/Category Descriptions:**

CTF event descriptions and rules currently support **plain text only**. Markdown formatting is not rendered in these fields.

---

## 5. Email Configuration

The platform can send emails for password resets, registration confirmations, and notifications.

### Option 1: AWS SES (Production-Tested)

AWS Simple Email Service provides reliable, scalable email delivery with excellent deliverability.

**Setup AWS SES:**

1. **Verify your domain in AWS SES Console:**
   - Go to AWS SES Console → Verified identities
   - Add and verify your sending domain
   - Configure DKIM and SPF records (AWS provides values)

2. **Create SMTP Credentials:**
   - In SES Console → SMTP Settings
   - Click "Create SMTP Credentials"
   - Save the username and password

3. **Get your SMTP endpoint:**
   - Format: `email-smtp.<region>.amazonaws.com`
   - Example: `email-smtp.us-east-1.amazonaws.com`

**Application Configuration (.env):**
```bash
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-ses-smtp-username
SMTP_PASS=your-ses-smtp-password
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME="raptorsCTF Platform"
```

**Move out of SES Sandbox (for production):**
- By default, SES is in sandbox mode (can only send to verified addresses)
- Request production access in SES Console
- Typically approved within 24 hours

### Option 2: Sendmail (Local Mail Server)

**Install Sendmail:**
```bash
sudo apt update
sudo apt install sendmail sendmail-cf mailutils -y
```

**Configure Sendmail:**

1. Edit configuration:
   ```bash
   sudo nano /etc/mail/sendmail.mc
   ```

2. Ensure these lines are present:
   ```
   FEATURE(`use_cw_file')dnl
   FEATURE(`access_db', `hash -T<TMPF> /etc/mail/access')dnl
   ```

3. Set hostname:
   ```bash
   sudo hostnamectl set-hostname mail.yourdomain.com
   echo "mail.yourdomain.com" | sudo tee /etc/mail/local-host-names
   ```

4. Rebuild configuration:
   ```bash
   sudo sendmailconfig  # Answer 'Y' to all prompts
   ```

5. Restart Sendmail:
   ```bash
   sudo systemctl restart sendmail
   sudo systemctl enable sendmail
   ```

**Test:**
```bash
echo "Test email body" | mail -s "Test Subject" your-email@example.com
sudo tail -f /var/log/mail.log
```

### Option 3: Postfix with External SMTP

For better deliverability, use Postfix as a relay to external SMTP services.

**Install Postfix:**
```bash
sudo apt install postfix libsasl2-modules -y
# Select "Internet Site" during installation
```

**Configure SMTP Relay:**

1. Edit configuration:
   ```bash
   sudo nano /etc/postfix/main.cf
   ```

   Add these lines:
   ```
   relayhost = [smtp.gmail.com]:587
   smtp_sasl_auth_enable = yes
   smtp_sasl_password_maps = hash:/etc/postfix/sasl_passwd
   smtp_sasl_security_options = noanonymous
   smtp_tls_security_level = encrypt
   smtp_tls_CAfile = /etc/ssl/certs/ca-certificates.crt
   ```

2. Create password file:
   ```bash
   sudo nano /etc/postfix/sasl_passwd
   ```

   Add credentials:
   ```
   [smtp.gmail.com]:587 your-email@gmail.com:your-app-password
   ```

   For Gmail, use an [App Password](https://myaccount.google.com/apppasswords).

3. Secure and hash:
   ```bash
   sudo chmod 600 /etc/postfix/sasl_passwd
   sudo postmap /etc/postfix/sasl_passwd
   ```

4. Restart:
   ```bash
   sudo systemctl restart postfix
   sudo systemctl enable postfix
   ```

**Other SMTP Providers (with Postfix):**

**SendGrid:**
```
relayhost = [smtp.sendgrid.net]:587
# Password file: apikey:your-sendgrid-api-key
```

**Mailgun:**
```
relayhost = [smtp.mailgun.org]:587
# Password file: postmaster@your-domain.mailgun.org:your-password
```

**Gmail:**
```
relayhost = [smtp.gmail.com]:587
# Password file: your-email@gmail.com:your-app-password
```

### DNS Configuration for Deliverability

**SPF Record** (TXT):
```
v=spf1 a mx ip4:YOUR_SERVER_IP ~all
```

**DKIM:**

1. Install OpenDKIM:
   ```bash
   sudo apt install opendkim opendkim-tools -y
   ```

2. Generate keys:
   ```bash
   sudo mkdir -p /etc/opendkim/keys/yourdomain.com
   sudo opendkim-genkey -b 2048 -d yourdomain.com -D /etc/opendkim/keys/yourdomain.com -s mail -v
   ```

3. Add public key to DNS (check generated `.txt` file)

**DMARC Record** (TXT named `_dmarc`):
```
v=DMARC1; p=quarantine; rua=mailto:admin@yourdomain.com
```

### Application Configuration Summary

Add the appropriate configuration to `.env` based on your email provider:

**AWS SES (Production-tested - see Option 1 above):**
```bash
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-ses-smtp-username
SMTP_PASS=your-ses-smtp-password
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME="raptorsCTF Platform"
```

**Local Sendmail:**
```bash
SMTP_HOST=localhost
SMTP_PORT=25
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME="raptorsCTF Platform"
```

**Postfix with External SMTP (Gmail, SendGrid, etc.):**
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=your-email@gmail.com
EMAIL_FROM_NAME="raptorsCTF Platform"
```

---

## 6. Production Deployment

### Build and Run

**Build:**
```bash
npm run build
```

**Start:**
```bash
npm run start
```

### Using PM2 (Recommended)

PM2 keeps your application running and provides process management.

**Install PM2:**
```bash
npm install -g pm2
```

**Start application:**
```bash
pm2 start npm --name "ctf" -- start
```

**Save configuration:**
```bash
pm2 save
pm2 startup  # Run the generated command
```

**Useful PM2 commands:**
```bash
pm2 status              # View running processes
pm2 logs ctf            # View logs
pm2 restart ctf         # Restart application
pm2 stop ctf            # Stop application
pm2 delete ctf          # Remove from PM2
pm2 monit               # Monitor resources
```

### Systemd Service (Alternative)

Create `/etc/systemd/system/ctf-platform.service`:

```ini
[Unit]
Description=raptorsCTF Platform
After=network.target postgresql.service

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/ctf_platform
Environment="NODE_ENV=production"
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=ctf-platform

# Docker socket access
SupplementaryGroups=docker

[Install]
WantedBy=multi-user.target
```

**Enable and start:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable ctf-platform
sudo systemctl start ctf-platform
sudo systemctl status ctf-platform
```

### Firewall Configuration

**Basic firewall setup:**
```bash
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable
```

**For direct container access (if not using nginx proxy):**
```bash
sudo ufw allow 30000:40000/tcp  # Container port range
```

### SSL Certificate Auto-Renewal

Certbot automatically renews certificates. Verify renewal works:

```bash
sudo certbot renew --dry-run
```

Renewal timer:
```bash
sudo systemctl status certbot.timer
```

---

## 7. Troubleshooting

### Application Issues

**Application won't start:**
```bash
# Check logs
npm run dev  # Development mode for detailed errors

# Or with PM2:
pm2 logs ctf

# Or with systemd:
sudo journalctl -u ctf-platform -f
```

**Database connection errors:**
```bash
# Test PostgreSQL connection
psql postgresql://ctf_user:password@localhost:5432/ctf_platform

# Check PostgreSQL is running
sudo systemctl status postgresql

# View PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*-main.log
```

**Port already in use:**
```bash
# Find what's using port 5001
sudo lsof -i :5001

# Kill the process
sudo kill -9 <PID>
```

### Container Issues

**Container won't start:**
```bash
# Check Docker daemon
sudo systemctl status docker

# Check Docker socket permissions
ls -la /var/run/docker.sock

# View container logs from Admin UI, or:
docker logs <container-name>

# Check if user is in docker group
groups $USER

# If not, add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

**Port allocation errors:**
```bash
# List allocated ports
docker ps --format "table {{.Names}}\t{{.Ports}}"

# Check ports in use
sudo lsof -i :30000-40000
```

**Orphaned containers:**
```bash
# View all containers
docker ps -a

# Remove specific container
docker rm -f <container-id>

# Or use Admin UI → Docker Containers → Cleanup Orphans
```

**Clean up Docker resources:**
```bash
# Remove stopped containers
docker container prune

# Remove unused images
docker image prune

# Remove all unused resources
docker system prune -a
```

### Email Issues

**Emails not sending:**
```bash
# Check mail service status
sudo systemctl status sendmail
# or
sudo systemctl status postfix

# View mail queue
mailq

# Check mail logs
sudo tail -100 /var/log/mail.log
sudo tail -100 /var/log/mail.err
```

**Clear stuck mail queue:**
```bash
# Postfix
sudo postsuper -d ALL

# Sendmail
sudo rm -f /var/spool/mqueue/*
```

**Test SMTP connection:**
```bash
telnet localhost 25
```

### Nginx Issues

**Nginx won't start:**
```bash
# Test configuration
sudo nginx -t

# View error logs
sudo tail -f /var/log/nginx/error.log

# Check if port 80/443 is in use
sudo lsof -i :80
sudo lsof -i :443
```

**SSL certificate errors:**
```bash
# Verify certificate
sudo openssl x509 -in /etc/letsencrypt/live/your-domain.com/fullchain.pem -text -noout

# Test SSL connection
openssl s_client -connect your-domain.com:443
```

**502 Bad Gateway:**
- Check if application is running (`pm2 status` or `systemctl status ctf-platform`)
- Verify application is listening on correct port (default: 5001)
- Check nginx error logs for connection refused errors

### Permission Issues

**File upload errors:**
```bash
# Check upload directory permissions
ls -la uploads/

# Fix permissions
sudo chown -R $USER:$USER uploads/
chmod -R 755 uploads/
```

**Database permission errors:**
```bash
# Grant database permissions
sudo -u postgres psql
GRANT ALL PRIVILEGES ON DATABASE ctf_platform TO ctf_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ctf_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ctf_user;
```

### Performance Issues

**High memory usage:**
```bash
# Monitor resources
pm2 monit

# Or with htop
htop

# Restart application
pm2 restart ctf
```

**Database slow queries:**
```bash
# Check PostgreSQL stats
sudo -u postgres psql ctf_platform
SELECT * FROM pg_stat_activity;
```

**Too many Docker containers:**
```bash
# Check container count
docker ps -a | wc -l

# Remove stopped containers
docker container prune
```

---

## 8. Security Considerations

**Application Security:**
- Session-based authentication with secure cookies
- Input validation on all endpoints
- Rate limiting on API endpoints (500 requests per 15 minutes)
- Helmet.js security headers
- XSS protection via Markdown sanitization
- CSRF protection via SameSite cookies

**File Security:**
- Hidden file access blocked (`.git`, `.env`, etc.)
- File upload size limits enforced
- Uploaded files stored outside web root
- Docker image validation

**Container Security:**
- Resource limits enforced (memory, CPU)
- Containers use Docker bridge networks
- No container-to-container communication by default
- Isolated from host network

**Database Security:**
- Parameterized queries via Drizzle ORM
- Password hashing with bcrypt
- Role-based access control
- Owner account protection

**Network Security:**
- SSL/TLS encryption (HTTPS)
- Firewall rules for exposed ports
- Nginx reverse proxy for SSL termination
- Rate limiting on authentication endpoints

---

## License

MIT
