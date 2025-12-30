# raptorsCTF Platform

A competitive Capture The Flag platform built with React, Express, and PostgreSQL.

## Features

- Multi-CTF event management with configurable timelines
- **Private events with invite codes** - Create invite-only competitions
- **Owner/Admin/User role hierarchy** - Protected platform ownership with multi-admin support
- Team-based and individual competition modes
- Dynamic and static scoring systems
- Challenge categories (Web, Crypto, Pwn, Reverse, Forensics, Misc, OSINT)
- **Markdown support for challenge descriptions** - Rich formatting with XSS protection
- First blood recognition
- File attachments for challenges
- Real-time leaderboard with graphs
- Admin dashboard for challenge and user management

## Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Ubuntu Server (for production deployment)

## Quick Start

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Copy the example environment file and configure:
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. Run the setup script to create the database:
   ```bash
   ./setup.sh
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## Creating Challenges

Challenge descriptions support Markdown formatting for rich text with security. See [MARKDOWN_GUIDE.md](MARKDOWN_GUIDE.md) for formatting examples and syntax.

## Container Management

raptorsCTF includes a built-in container orchestration system for deploying challenge infrastructure (web servers, services, vulnerable applications, etc.). Containers can be linked to challenges and made accessible to users during active CTF events.

### Prerequisites

- Docker installed and running
- User running the application must have Docker socket access

### Docker Setup

#### Linux/Ubuntu

1. Install Docker:
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   ```

2. Add your user to the docker group (to avoid needing sudo):
   ```bash
   sudo usermod -aG docker $USER
   newgrp docker
   ```

3. Verify Docker is running:
   ```bash
   docker ps
   ```

#### Configuration

Add these variables to your `.env` file:

```bash
# Container Management
DOCKER_SOCKET=/var/run/docker.sock
CONTAINER_PORT_RANGE_MIN=30000
CONTAINER_PORT_RANGE_MAX=40000
```

- **DOCKER_SOCKET**: Path to Docker daemon socket (default: `/var/run/docker.sock`)
- **CONTAINER_PORT_RANGE_MIN**: Minimum port for container allocation (default: `30000`)
- **CONTAINER_PORT_RANGE_MAX**: Maximum port for container allocation (default: `40000`)

### Firewall Configuration

The platform dynamically allocates ports in the configured range. Ensure these ports are accessible:

```bash
# Allow container port range
sudo ufw allow 30000:40000/tcp

# Or for specific external access, use nginx reverse proxy (recommended)
```

### Using Containers

#### From Admin Dashboard

1. **Add a Container:**
   - Navigate to Admin → Containers
   - Click "Add Container"
   - Choose deployment method:
     - **Registry Pull**: Pull from Docker Hub, private registry, or AWS ECR
     - **Upload**: Upload a `.tar` file containing a Docker image

2. **Configure Container:**
   - Set name and description
   - Define exposed ports (e.g., port 80 for web services)
   - Add environment variables
   - Set resource limits (memory, CPU)

3. **Deploy Container:**
   - Click "Deploy" on a container
   - System will allocate a unique port from the configured range
   - Container starts and becomes accessible

4. **Link to Challenge:**
   - Edit a challenge
   - In "Linked Containers" section, select your deployed container
   - Users will see container access information when viewing the challenge

#### Container Lifecycle

- **Deploy**: Starts container with allocated ports
- **Stop**: Stops container and releases ports
- **View Logs**: See container output for debugging
- **Status**: Check if container is running/stopped/failed

### Port Allocation

The system automatically allocates ports from the configured range (default: 30000-40000) to avoid conflicts. Each deployed container gets a unique port mapping.

**Example:**
- Container exposes port `80` internally
- System allocates host port `30001`
- Users access via `http://your-domain.com:30001`

### Security Considerations

#### Resource Limits

Set appropriate limits per container to prevent resource exhaustion:
- Default: 512MB RAM, 0.5 vCPU per container
- Configurable in admin UI when creating/editing containers

#### Network Isolation

- Containers use Docker bridge networks
- No container-to-container communication by default
- Isolated from host network

#### Port Security

- Configure firewall rules for the allocated port range only
- Use nginx reverse proxy for SSL termination (recommended)
- Monitor port usage in admin dashboard

#### File Validation

When uploading `.tar` container images:
- Max file size: 2GB per image
- Files are validated for Docker image format
- Stored in `/uploads/containers/` directory

### Advanced: Nginx Reverse Proxy

For production, use nginx to proxy container access with SSL:

```nginx
# /etc/nginx/sites-available/ctf-containers
location ~ ^/container/(\d+)$ {
    # Auth check (optional - integrate with your auth system)
    # proxy_pass to dynamically allocated port
    proxy_pass http://127.0.0.1:$backend_port;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;

    # WebSocket support for interactive challenges
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

### Troubleshooting

#### Container won't start

```bash
# Check Docker daemon status
sudo systemctl status docker

# Check Docker socket permissions
ls -la /var/run/docker.sock

# View container logs from admin UI or:
docker logs <container-name>
```

#### Port allocation errors

```bash
# List allocated ports
docker ps --format "table {{.Names}}\t{{.Ports}}"

# Check if ports are in use
sudo lsof -i :30000-40000
```

#### Permission denied errors

```bash
# Ensure user is in docker group
groups $USER

# If not, add and reload:
sudo usermod -aG docker $USER
newgrp docker
```

#### Clean up stopped containers

The system manages container lifecycle, but you can manually clean up:

```bash
# Remove all stopped containers
docker container prune

# Remove unused images
docker image prune
```

## Production Deployment

### Database Migrations

If you're updating an existing production deployment, you may need to run database migrations:

- **Owner Role Migration**: If upgrading from a version without owner roles, see [MIGRATION_OWNER_ROLE.md](MIGRATION_OWNER_ROLE.md) for instructions on upgrading your first admin to owner.

### Build and Run

```bash
npm run build
npm run start
```

### Using PM2 (Recommended)

```bash
npm install -g pm2
pm2 start npm --name "ctf" -- start
pm2 save
pm2 startup
```

---

## Email Configuration (Sendmail)

The raptorsCTF Platform can send emails for password resets, registration confirmations, and notifications. This guide covers setting up Sendmail on Ubuntu.

### Option 1: Sendmail (Local Mail Server)

#### Install Sendmail

```bash
sudo apt update
sudo apt install sendmail sendmail-cf mailutils -y
```

#### Configure Sendmail

1. Edit the Sendmail configuration:
   ```bash
   sudo nano /etc/mail/sendmail.mc
   ```

2. Ensure these lines are present (uncomment if needed):
   ```
   FEATURE(`use_cw_file')dnl
   FEATURE(`access_db', `hash -T<TMPF> /etc/mail/access')dnl
   ```

3. Set your server's hostname:
   ```bash
   sudo hostnamectl set-hostname mail.yourdomain.com
   echo "mail.yourdomain.com" | sudo tee /etc/mail/local-host-names
   ```

4. Rebuild the configuration:
   ```bash
   sudo sendmailconfig
   # Answer 'Y' to all prompts
   ```

5. Restart Sendmail:
   ```bash
   sudo systemctl restart sendmail
   sudo systemctl enable sendmail
   ```

#### Test Sendmail

```bash
echo "Test email body" | mail -s "Test Subject" your-email@example.com
```

Check the mail log for errors:
```bash
sudo tail -f /var/log/mail.log
```

### Option 2: Postfix with External SMTP (Recommended for Deliverability)

For better email deliverability, use Postfix as a relay to an external SMTP service.

#### Install Postfix

```bash
sudo apt update
sudo apt install postfix libsasl2-modules -y
# Select "Internet Site" during installation
```

#### Configure SMTP Relay (Gmail Example)

1. Edit Postfix configuration:
   ```bash
   sudo nano /etc/postfix/main.cf
   ```

2. Add/modify these lines:
   ```
   relayhost = [smtp.gmail.com]:587
   smtp_sasl_auth_enable = yes
   smtp_sasl_password_maps = hash:/etc/postfix/sasl_passwd
   smtp_sasl_security_options = noanonymous
   smtp_tls_security_level = encrypt
   smtp_tls_CAfile = /etc/ssl/certs/ca-certificates.crt
   ```

3. Create the password file:
   ```bash
   sudo nano /etc/postfix/sasl_passwd
   ```

   Add your credentials:
   ```
   [smtp.gmail.com]:587 your-email@gmail.com:your-app-password
   ```

   > **Note:** For Gmail, use an [App Password](https://myaccount.google.com/apppasswords), not your regular password.

4. Secure and hash the password file:
   ```bash
   sudo chmod 600 /etc/postfix/sasl_passwd
   sudo postmap /etc/postfix/sasl_passwd
   ```

5. Restart Postfix:
   ```bash
   sudo systemctl restart postfix
   sudo systemctl enable postfix
   ```

#### Other SMTP Providers

**SendGrid:**
```
relayhost = [smtp.sendgrid.net]:587
```
Password file: `apikey:your-sendgrid-api-key`

**Mailgun:**
```
relayhost = [smtp.mailgun.org]:587
```
Password file: `postmaster@your-domain.mailgun.org:your-password`

**Amazon SES:**
```
relayhost = [email-smtp.us-east-1.amazonaws.com]:587
```
Password file: `your-smtp-username:your-smtp-password`

### Application Email Configuration

Add these environment variables to your `.env` file:

```bash
# Email Configuration
SMTP_HOST=localhost
SMTP_PORT=25
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME="raptorsCTF Platform"
```

For external SMTP (if not using local sendmail):

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=your-email@gmail.com
EMAIL_FROM_NAME="raptorsCTF Platform"
```

### DNS Configuration for Email Deliverability

To improve email deliverability and prevent emails from being marked as spam:

#### SPF Record

Add a TXT record to your domain's DNS:
```
v=spf1 a mx ip4:YOUR_SERVER_IP ~all
```

#### DKIM (DomainKeys Identified Mail)

1. Install OpenDKIM:
   ```bash
   sudo apt install opendkim opendkim-tools -y
   ```

2. Generate DKIM keys:
   ```bash
   sudo mkdir -p /etc/opendkim/keys/yourdomain.com
   sudo opendkim-genkey -b 2048 -d yourdomain.com -D /etc/opendkim/keys/yourdomain.com -s mail -v
   ```

3. Add the public key to your DNS as a TXT record (check the generated `.txt` file).

#### DMARC Record

Add a TXT record named `_dmarc`:
```
v=DMARC1; p=quarantine; rua=mailto:admin@yourdomain.com
```

### Troubleshooting

#### Check if mail service is running
```bash
sudo systemctl status sendmail
# or
sudo systemctl status postfix
```

#### View mail queue
```bash
mailq
```

#### Clear stuck mail queue
```bash
sudo postsuper -d ALL  # Postfix
sudo rm -f /var/spool/mqueue/*  # Sendmail
```

#### Check mail logs
```bash
sudo tail -100 /var/log/mail.log
sudo tail -100 /var/log/mail.err
```

#### Test SMTP connection
```bash
telnet localhost 25
```

#### Firewall rules (if needed)
```bash
sudo ufw allow 25/tcp   # SMTP
sudo ufw allow 587/tcp  # Submission
```

---

## Security Considerations

- The platform includes rate limiting on API endpoints
- Helmet.js provides security headers
- Hidden file access (`.git`, `.env`) is blocked
- Session-based authentication with secure cookies
- Input validation on all endpoints

## License

MIT
