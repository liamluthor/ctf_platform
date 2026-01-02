# Deployment Guide

## Quick Start

For a fresh Ubuntu 22.04/24.04 server:

```bash
# Clone repository
git clone https://github.com/liamluthor/ctf_platform.git
cd ctf_platform

# Run automated setup
sudo ./scripts/setup-production.sh
```

The script will prompt for configuration (domain, email, database credentials) and handle everything automatically.

## Manual Setup

If you prefer manual setup or need to customize the process:

### Prerequisites
- Ubuntu 22.04/24.04 LTS
- Root access
- Domain name pointing to server IP
- Ports 80, 443, 5432 available

### 1. Install Dependencies

```bash
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs

# PostgreSQL 16
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt-get update
sudo apt-get install -y postgresql-16

# Docker
curl -fsSL https://get.docker.com | sudo sh

# Nginx & Certbot
sudo apt-get install -y nginx certbot python3-certbot-nginx

# Postfix
sudo apt-get install -y postfix
```

### 2. Configure Database

```bash
sudo -u postgres psql <<EOF
CREATE USER ctf_admin WITH PASSWORD 'your_secure_password';
CREATE DATABASE ctf_platform OWNER ctf_admin;
GRANT ALL PRIVILEGES ON DATABASE ctf_platform TO ctf_admin;
\c ctf_platform
GRANT ALL ON SCHEMA public TO ctf_admin;
EOF
```

### 3. Clone and Configure Application

```bash
sudo mkdir -p /srv/ctf-platform
cd /srv/ctf-platform
git clone https://github.com/YOUR_USERNAME/raptorsCTF.git .

# Create .env file
cat > .env <<EOF
DATABASE_URL=postgresql://ctf_admin:your_password@localhost:5432/ctf_platform
SESSION_SECRET=$(openssl rand -hex 64)
BASE_URL=https://your-domain.com
SMTP_HOST=localhost
SMTP_PORT=25
EMAIL_FROM=noreply@your-domain.com
NODE_ENV=production
EOF

# Install and build
npm install
npm run db:generate
npm run db:push
npm run build
```

### 4. Configure Nginx

```bash
# Copy and configure nginx template
sudo cp nginx-container-proxy.conf.template /etc/nginx/sites-available/ctf-platform.conf
sudo sed -i 's/YOUR_DOMAIN/your-domain.com/g' /etc/nginx/sites-available/ctf-platform.conf

# Enable site
sudo ln -s /etc/nginx/sites-available/ctf-platform.conf /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

### 5. Obtain SSL Certificate

```bash
sudo certbot --nginx -d your-domain.com
```

### 6. Create Systemd Service

```bash
sudo tee /etc/systemd/system/ctf-platform.service <<EOF
[Unit]
Description=raptorsCTF Platform
After=network.target postgresql.service

[Service]
Type=simple
User=$USER
WorkingDirectory=/srv/ctf-platform
Environment="NODE_ENV=production"
ExecStart=/usr/bin/node /srv/ctf-platform/dist/index.cjs
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable ctf-platform
sudo systemctl start ctf-platform
```

### 7. Configure Firewall

```bash
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw allow 30000:40000/tcp  # Container port range
sudo ufw enable
```

### 8. Create Admin User

```bash
cd /srv/ctf-platform
npm run db:create-admin
```

## Configuration

### Environment Variables

See `.env.example` for all available options.

Required variables:
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Secret for session encryption
- `BASE_URL` - Public URL of your platform
- `EMAIL_FROM` - Sender email address

Optional variables:
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` - External SMTP
- `PLATFORM_NAME`, `PLATFORM_TAGLINE` - Branding
- `CONTAINER_PORT_RANGE_MIN/MAX` - Container port allocation

### Email Setup

For production email delivery, configure SPF and DKIM:

```bash
# SPF Record (DNS TXT)
v=spf1 a mx ~all

# DKIM (install opendkim)
sudo apt-get install opendkim opendkim-tools
```

See [Email Setup Guide](./EMAIL_SETUP.md) for detailed instructions.

## Updates

To update an existing installation:

```bash
cd /srv/ctf-platform
git pull origin main
npm install
npm run db:generate
npm run db:push
npm run build
sudo systemctl restart ctf-platform
```

## Troubleshooting

### Service Not Starting

```bash
# Check logs
sudo journalctl -u ctf-platform -n 50

# Check if database is accessible
psql $DATABASE_URL -c "SELECT version();"

# Check if port is available
sudo netstat -tuln | grep 5000
```

### Nginx Errors

```bash
# Test configuration
sudo nginx -t

# Check error logs
sudo tail -f /var/log/nginx/error.log

# Verify upstream is running
curl http://localhost:5000/api/health
```

### Container Issues

```bash
# Check Docker
sudo docker ps
sudo docker logs <container_id>

# Verify port allocation
sudo netstat -tuln | grep 30000
```

### Email Not Sending

```bash
# Test Postfix
echo "Test" | mail -s "Test" your@email.com

# Check mail logs
sudo tail -f /var/log/mail.log

# Verify Postfix is running
sudo systemctl status postfix
```

## Security Checklist

- [ ] Strong database password
- [ ] Unique session secret
- [ ] SSL certificate configured
- [ ] Firewall enabled (UFW)
- [ ] Fail2Ban configured
- [ ] Regular backups scheduled
- [ ] Email SPF/DKIM configured
- [ ] Strong admin password
- [ ] System updates automated
- [ ] Monitoring configured

## Backup

### Database Backup

```bash
# Manual backup
pg_dump -U ctf_admin ctf_platform > backup_$(date +%Y%m%d).sql

# Automated daily backup (cron)
0 2 * * * pg_dump -U ctf_admin ctf_platform > /backups/ctf_$(date +\%Y\%m\%d).sql
```

### Full Backup

```bash
# Backup everything
tar -czf ctf_backup_$(date +%Y%m%d).tar.gz \
  /srv/ctf-platform/.env \
  /srv/ctf-platform/uploads \
  /etc/nginx/sites-available/ctf-platform.conf
```

## Monitoring

Recommended monitoring tools:
- **Application**: PM2 or systemd with logging
- **Server**: Netdata or Prometheus
- **Uptime**: UptimeRobot or Pingdom
- **Logs**: Loki or ELK stack

## Support

- **Documentation**: `/docs` directory
- **Issues**: GitHub Issues
- **Logs**: `journalctl -u ctf-platform -f`
