#!/bin/bash
# Production Setup Script for raptorsCTF Platform
# This script automates the complete deployment process
# Supports: Ubuntu 22.04/24.04 LTS
#
# USAGE: sudo ./scripts/setup-production.sh
#
# This script will prompt for:
#   - Domain name
#   - Admin email (for SSL)
#   - Database credentials
#   - Git repository details
#
# The script automatically:
#   - Installs all dependencies
#   - Configures SSL with Let's Encrypt
#   - Sets up database and migrations
#   - Creates systemd service
#   - Configures firewall

set -e  # Exit on error

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[i]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "This script must be run as root"
    echo "Usage: sudo ./setup-production.sh"
    exit 1
fi

# Get the actual user who ran sudo
ACTUAL_USER=${SUDO_USER:-$USER}
ACTUAL_HOME=$(eval echo ~$ACTUAL_USER)

print_header "raptorsCTF Production Setup"
echo ""
print_info "This script will install and configure:"
print_info "  - Node.js 20 LTS"
print_info "  - PostgreSQL 16"
print_info "  - Nginx with SSL (Let's Encrypt)"
print_info "  - Docker (for container challenges)"
print_info "  - Postfix (for email)"
print_info "  - System hardening (firewall, fail2ban)"
echo ""

# Prompt for configuration
read -p "Domain name (e.g., ctf.example.com): " DOMAIN
read -p "Admin email (for SSL certificates): " ADMIN_EMAIL
read -p "PostgreSQL database name [ctf_platform]: " DB_NAME
DB_NAME=${DB_NAME:-ctf_platform}
read -p "PostgreSQL user [ctf_admin]: " DB_USER
DB_USER=${DB_USER:-ctf_admin}
read -sp "PostgreSQL password (leave empty to generate): " DB_PASS
echo ""
if [ -z "$DB_PASS" ]; then
    DB_PASS=$(openssl rand -hex 32)
    print_info "Generated database password: $DB_PASS"
fi

read -sp "Session secret (leave empty to generate): " SESSION_SECRET
echo ""
if [ -z "$SESSION_SECRET" ]; then
    SESSION_SECRET=$(openssl rand -hex 64)
    print_info "Generated session secret"
fi

read -p "Installation directory [/srv/ctf-platform]: " INSTALL_DIR
INSTALL_DIR=${INSTALL_DIR:-/srv/ctf-platform}

read -p "Git repository URL: " GIT_REPO
read -p "Git branch [main]: " GIT_BRANCH
GIT_BRANCH=${GIT_BRANCH:-main}

echo ""
print_warn "This script will make system-wide changes. Continue? (y/N)"
read -p "> " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    print_error "Installation cancelled"
    exit 1
fi

# ========================================
# 1. System Requirements Check
# ========================================
print_header "Step 1: System Requirements Check"

# Check OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    if [[ "$ID" != "ubuntu" ]]; then
        print_warn "This script is designed for Ubuntu. Your OS: $ID"
        print_warn "Continue anyway? (y/N)"
        read -p "> " CONTINUE
        if [[ ! "$CONTINUE" =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    print_success "OS: $PRETTY_NAME"
else
    print_error "Cannot detect OS"
    exit 1
fi

# Check architecture
ARCH=$(uname -m)
if [[ "$ARCH" != "x86_64" ]]; then
    print_warn "Architecture: $ARCH (recommended: x86_64)"
fi

# Check available disk space (need at least 10GB)
AVAILABLE_SPACE=$(df / | tail -1 | awk '{print $4}')
if [ "$AVAILABLE_SPACE" -lt 10485760 ]; then  # 10GB in KB
    print_warn "Low disk space. Recommended: 10GB+"
fi

# Check if ports are available
for port in 80 443 5432; do
    if netstat -tuln 2>/dev/null | grep -q ":$port "; then
        print_warn "Port $port is already in use"
    fi
done

print_success "System requirements check complete"

# ========================================
# 2. Update System
# ========================================
print_header "Step 2: Updating System Packages"

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get upgrade -y
apt-get install -y curl wget git build-essential software-properties-common ufw fail2ban

print_success "System updated"

# ========================================
# 3. Install Node.js 20 LTS
# ========================================
print_header "Step 3: Installing Node.js 20 LTS"

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_info "Node.js already installed: $NODE_VERSION"
    print_warn "Reinstall? (y/N)"
    read -p "> " REINSTALL_NODE
    if [[ "$REINSTALL_NODE" =~ ^[Yy]$ ]]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    fi
else
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
print_success "Node.js: $NODE_VERSION, npm: $NPM_VERSION"

# ========================================
# 4. Install PostgreSQL 16
# ========================================
print_header "Step 4: Installing PostgreSQL 16"

if command -v psql &> /dev/null; then
    PG_VERSION=$(psql --version)
    print_info "PostgreSQL already installed: $PG_VERSION"
else
    # Add PostgreSQL repository
    sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
    wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
    apt-get update
    apt-get install -y postgresql-16 postgresql-contrib-16
fi

# Start PostgreSQL
systemctl enable postgresql
systemctl start postgresql

# Create database and user
print_info "Creating database and user..."
sudo -u postgres psql <<EOF
-- Drop existing database and user if they exist (for clean install)
DROP DATABASE IF EXISTS $DB_NAME;
DROP USER IF EXISTS $DB_USER;

-- Create user with password
CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';

-- Create database
CREATE DATABASE $DB_NAME OWNER $DB_USER;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;

-- Switch to the database and grant schema privileges
\c $DB_NAME
GRANT ALL ON SCHEMA public TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;
EOF

print_success "PostgreSQL configured"

# ========================================
# 5. Install Docker
# ========================================
print_header "Step 5: Installing Docker"

if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    print_info "Docker already installed: $DOCKER_VERSION"
else
    # Install Docker
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh

    # Add user to docker group
    usermod -aG docker $ACTUAL_USER

    # Enable Docker service
    systemctl enable docker
    systemctl start docker
fi

print_success "Docker installed"

# ========================================
# 6. Install Nginx
# ========================================
print_header "Step 6: Installing Nginx"

if command -v nginx &> /dev/null; then
    NGINX_VERSION=$(nginx -v 2>&1)
    print_info "Nginx already installed: $NGINX_VERSION"
else
    apt-get install -y nginx
    systemctl enable nginx
fi

print_success "Nginx installed"

# ========================================
# 7. Install Certbot for SSL
# ========================================
print_header "Step 7: Installing Certbot (Let's Encrypt)"

apt-get install -y certbot python3-certbot-nginx

print_success "Certbot installed"

# ========================================
# 8. Install Postfix for Email
# ========================================
print_header "Step 8: Installing Postfix"

print_info "Configuring Postfix as send-only relay..."
debconf-set-selections <<< "postfix postfix/mailname string $DOMAIN"
debconf-set-selections <<< "postfix postfix/main_mailer_type string 'Internet Site'"
apt-get install -y postfix mailutils

# Configure Postfix for send-only
postconf -e "inet_interfaces = loopback-only"
postconf -e "mydestination = localhost"
postconf -e "myhostname = $DOMAIN"

systemctl restart postfix

print_success "Postfix configured"
print_warn "Remember to configure SPF/DKIM records for better email deliverability"

# ========================================
# 9. Clone Application
# ========================================
print_header "Step 9: Cloning Application"

# Create installation directory
mkdir -p $INSTALL_DIR
cd $INSTALL_DIR

# Clone repository
if [ -d "$INSTALL_DIR/.git" ]; then
    print_info "Repository already cloned. Pulling latest changes..."
    sudo -u $ACTUAL_USER git fetch origin
    sudo -u $ACTUAL_USER git checkout $GIT_BRANCH
    sudo -u $ACTUAL_USER git pull origin $GIT_BRANCH
else
    print_info "Cloning repository..."
    sudo -u $ACTUAL_USER git clone -b $GIT_BRANCH $GIT_REPO .
fi

# Set ownership
chown -R $ACTUAL_USER:$ACTUAL_USER $INSTALL_DIR

print_success "Application cloned"

# ========================================
# 10. Configure Environment
# ========================================
print_header "Step 10: Configuring Environment"

# Create .env file
cat > $INSTALL_DIR/.env <<EOF
# Database Configuration
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME

# Session Configuration
SESSION_SECRET=$SESSION_SECRET

# Platform Configuration
PLATFORM_NAME=raptorsCTF
PLATFORM_TAGLINE=Test Your Cybersecurity Skills
PRIMARY_COLOR=345 80% 35%

# Container Management (Docker)
DOCKER_SOCKET=/var/run/docker.sock
CONTAINER_PORT_RANGE_MIN=30000
CONTAINER_PORT_RANGE_MAX=40000

# Base URL (used for emails and container access)
BASE_URL=https://$DOMAIN

# Email Configuration (Postfix SMTP)
SMTP_HOST=localhost
SMTP_PORT=25
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=noreply@$DOMAIN
EMAIL_FROM_NAME=raptorsCTF Platform

# Server Configuration
NODE_ENV=production
PORT=5000
EOF

chown $ACTUAL_USER:$ACTUAL_USER $INSTALL_DIR/.env
chmod 600 $INSTALL_DIR/.env

print_success "Environment configured"

# ========================================
# 11. Install Dependencies
# ========================================
print_header "Step 11: Installing Application Dependencies"

cd $INSTALL_DIR
sudo -u $ACTUAL_USER npm install

print_success "Dependencies installed"

# ========================================
# 12. Run Database Migrations
# ========================================
print_header "Step 12: Running Database Migrations"

print_info "Generating database schema..."
sudo -u $ACTUAL_USER npm run db:generate

print_info "Applying migrations..."
sudo -u $ACTUAL_USER npm run db:push

print_success "Database migrations complete"

# ========================================
# 13. Build Application
# ========================================
print_header "Step 13: Building Application"

sudo -u $ACTUAL_USER npm run build

print_success "Application built"

# ========================================
# 14. Create Systemd Service
# ========================================
print_header "Step 14: Creating Systemd Service"

cat > /etc/systemd/system/ctf-platform.service <<EOF
[Unit]
Description=raptorsCTF Platform
After=network.target postgresql.service

[Service]
Type=simple
User=$ACTUAL_USER
WorkingDirectory=$INSTALL_DIR
Environment="NODE_ENV=production"
ExecStart=/usr/bin/node $INSTALL_DIR/dist/index.cjs
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=ctf-platform

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$INSTALL_DIR/uploads
ReadWritePaths=/tmp

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ctf-platform
systemctl start ctf-platform

# Wait for service to start
sleep 3

if systemctl is-active --quiet ctf-platform; then
    print_success "Service started successfully"
else
    print_error "Service failed to start. Check logs: journalctl -u ctf-platform -n 50"
    exit 1
fi

# ========================================
# 15. Configure Nginx
# ========================================
print_header "Step 15: Configuring Nginx"

# Check if nginx config template exists
if [ -f "$INSTALL_DIR/nginx-container-proxy.conf.template" ]; then
    cp $INSTALL_DIR/nginx-container-proxy.conf.template /etc/nginx/sites-available/ctf-platform.conf

    # Replace YOUR_DOMAIN placeholder with actual domain
    sed -i "s/YOUR_DOMAIN/$DOMAIN/g" /etc/nginx/sites-available/ctf-platform.conf

    # Enable site
    ln -sf /etc/nginx/sites-available/ctf-platform.conf /etc/nginx/sites-enabled/

    # Remove default site
    rm -f /etc/nginx/sites-enabled/default

    # Test configuration
    if nginx -t; then
        print_success "Nginx configuration valid"
    else
        print_error "Nginx configuration invalid"
        exit 1
    fi
else
    print_error "Nginx configuration template not found: $INSTALL_DIR/nginx-container-proxy.conf.template"
    exit 1
fi

# ========================================
# 16. Obtain SSL Certificate
# ========================================
print_header "Step 16: Obtaining SSL Certificate"

print_info "Stopping nginx temporarily for certificate generation..."
systemctl stop nginx

# Obtain certificate
certbot certonly --standalone \
    --non-interactive \
    --agree-tos \
    --email $ADMIN_EMAIL \
    -d $DOMAIN

if [ $? -eq 0 ]; then
    print_success "SSL certificate obtained"

    # Start nginx
    systemctl start nginx
    systemctl reload nginx
else
    print_error "Failed to obtain SSL certificate"
    print_warn "Starting nginx without SSL..."
    systemctl start nginx
fi

# ========================================
# 17. Setup Firewall
# ========================================
print_header "Step 17: Configuring Firewall"

# Enable UFW
ufw --force enable

# Allow SSH (important!)
ufw allow 22/tcp

# Allow HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Allow container port range
ufw allow 30000:40000/tcp

# Show status
ufw status

print_success "Firewall configured"

# ========================================
# 18. Configure Fail2Ban
# ========================================
print_header "Step 18: Configuring Fail2Ban"

cat > /etc/fail2ban/jail.local <<EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log

[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log
EOF

systemctl enable fail2ban
systemctl restart fail2ban

print_success "Fail2Ban configured"

# ========================================
# 19. Create Admin User
# ========================================
print_header "Step 19: Creating Admin User"

print_info "You can create an admin user later with:"
print_info "  cd $INSTALL_DIR && npm run db:create-admin"
echo ""

# ========================================
# COMPLETE
# ========================================
print_header "Installation Complete!"
echo ""
print_success "raptorsCTF Platform is now running!"
echo ""
print_info "Access your platform at: https://$DOMAIN"
print_info "Application directory: $INSTALL_DIR"
print_info "Database: $DB_NAME (user: $DB_USER)"
print_info "Logs: journalctl -u ctf-platform -f"
echo ""
print_warn "IMPORTANT: Next Steps"
echo ""
echo "1. Create an admin user:"
echo "   cd $INSTALL_DIR && npm run db:create-admin"
echo ""
echo "2. Configure DNS:"
echo "   Point $DOMAIN to this server's IP address"
echo ""
echo "3. Configure email (SPF/DKIM):"
echo "   Add SPF record: v=spf1 a mx ~all"
echo "   Consider setting up DKIM for better deliverability"
echo ""
echo "4. Test email delivery:"
echo "   echo 'Test email' | mail -s 'Test' your@email.com"
echo ""
echo "5. Review security settings:"
echo "   - Change default passwords"
echo "   - Review firewall rules: sudo ufw status"
echo "   - Monitor logs: journalctl -u ctf-platform -f"
echo ""
echo "6. Setup automatic renewals for SSL:"
echo "   certbot renew --dry-run"
echo ""
print_success "Happy hacking! 🚀"
