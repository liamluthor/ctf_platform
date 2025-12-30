#!/bin/bash

# Container Proxy Setup Script for raptorsCTF
# Sets up Nginx reverse proxy with SSL termination for container access

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "This script must be run as root"
    echo "Usage: sudo ./setup-container-proxy.sh"
    exit 1
fi

# Get the actual user who ran sudo
ACTUAL_USER="${SUDO_USER:-$USER}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

print_info "Setting up Nginx container proxy for raptorsCTF"

# Check if Nginx is installed
if ! command -v nginx &> /dev/null; then
    print_error "Nginx is not installed"
    print_info "Please run setup-nginx.sh first or install Nginx manually"
    exit 1
fi

# Prompt for domain
read -p "Enter your domain name (e.g., ctf.strayerraptors.com): " DOMAIN
if [ -z "$DOMAIN" ]; then
    print_error "Domain name is required"
    exit 1
fi

# Prompt for backend port
read -p "Enter backend server port [5001]: " BACKEND_PORT
BACKEND_PORT=${BACKEND_PORT:-5001}

# Check if SSL certificates exist
SSL_CERT="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
SSL_KEY="/etc/letsencrypt/live/$DOMAIN/privkey.pem"

if [ ! -f "$SSL_CERT" ] || [ ! -f "$SSL_KEY" ]; then
    print_warn "SSL certificates not found at $SSL_CERT"
    print_info "Please obtain SSL certificates first:"
    print_info "  Option 1: Run setup-nginx.sh to set up Let's Encrypt"
    print_info "  Option 2: Manually install certificates"
    exit 1
fi

# Create nginx configuration
NGINX_CONF="/etc/nginx/sites-available/ctf-container-proxy.conf"
print_info "Creating Nginx configuration at $NGINX_CONF"

cat > "$NGINX_CONF" << 'EOF'
# CTF Container Proxy Configuration
# This handles dynamic proxying to containerized challenges with SSL termination

# Upstream for the main CTF backend
upstream ctf_backend {
    server 127.0.0.1:BACKEND_PORT;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name DOMAIN_NAME;

    # SSL Configuration
    ssl_certificate SSL_CERT_PATH;
    ssl_certificate_key SSL_KEY_PATH;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Logging
    access_log /var/log/nginx/ctf-containers-access.log;
    error_log /var/log/nginx/ctf-containers-error.log;

    # Main application proxy (non-container routes)
    location / {
        proxy_pass http://ctf_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Container proxy with auth subrequest (single port)
    location ~ ^/challenge/([0-9]+)/?$ {
        set $challenge_id $1;

        auth_request /internal/challenge-auth/$challenge_id;
        auth_request_set $backend_port $upstream_http_x_backend_port;

        error_page 401 = @challenge_unauthorized;
        error_page 403 = @challenge_forbidden;
        error_page 404 = @challenge_not_found;
        error_page 500 502 503 504 = @challenge_error;

        proxy_pass http://127.0.0.1:$backend_port/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        proxy_buffering off;
        add_header X-Content-Type-Options nosniff;
        add_header X-Frame-Options SAMEORIGIN;
    }

    # Container proxy with specific port (multi-port containers)
    location ~ ^/challenge/([0-9]+)/port/([0-9]+)(/.*)?$ {
        set $challenge_id $1;
        set $container_port $2;
        set $challenge_path $3;

        auth_request /internal/challenge-auth/$challenge_id/$container_port;
        auth_request_set $backend_port $upstream_http_x_backend_port;

        error_page 401 = @challenge_unauthorized;
        error_page 403 = @challenge_forbidden;
        error_page 404 = @challenge_not_found;
        error_page 500 502 503 504 = @challenge_error;

        proxy_pass http://127.0.0.1:$backend_port$challenge_path$is_args$args;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        proxy_buffering off;
        add_header X-Content-Type-Options nosniff;
        add_header X-Frame-Options SAMEORIGIN;
    }

    # Internal location for auth subrequest
    location ~ ^/internal/challenge-auth/([0-9]+)/?([0-9]+)?$ {
        internal;
        set $challenge_id $1;
        set $port_param $2;

        set $backend_url "/api/internal/challenge-proxy/$challenge_id";
        if ($port_param) {
            set $backend_url "/api/internal/challenge-proxy/$challenge_id/$port_param";
        }

        proxy_pass http://ctf_backend$backend_url;
        proxy_pass_request_body off;
        proxy_set_header Content-Length "";
        proxy_set_header X-Original-URI $request_uri;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Cookie $http_cookie;
    }

    # Error pages
    location @challenge_unauthorized {
        return 302 /auth?redirect=$request_uri;
    }

    location @challenge_forbidden {
        default_type text/html;
        return 403 '<html><body style="font-family: monospace; background: #1a1a1a; color: #00ff00; padding: 40px;"><h1>403 Forbidden</h1><p>You do not have access to this challenge container.</p></body></html>';
    }

    location @challenge_not_found {
        default_type text/html;
        return 404 '<html><body style="font-family: monospace; background: #1a1a1a; color: #00ff00; padding: 40px;"><h1>404 Not Found</h1><p>Challenge container not found or not running.</p></body></html>';
    }

    location @challenge_error {
        default_type text/html;
        return 502 '<html><body style="font-family: monospace; background: #1a1a1a; color: #00ff00; padding: 40px;"><h1>502 Bad Gateway</h1><p>Challenge container is not responding.</p></body></html>';
    }
}

server {
    listen 80;
    server_name DOMAIN_NAME;
    return 301 https://$server_name$request_uri;
}
EOF

# Replace placeholders
sed -i "s|DOMAIN_NAME|$DOMAIN|g" "$NGINX_CONF"
sed -i "s|BACKEND_PORT|$BACKEND_PORT|g" "$NGINX_CONF"
sed -i "s|SSL_CERT_PATH|$SSL_CERT|g" "$NGINX_CONF"
sed -i "s|SSL_KEY_PATH|$SSL_KEY|g" "$NGINX_CONF"

print_info "Nginx configuration created"

# Enable the site
if [ ! -L "/etc/nginx/sites-enabled/ctf-container-proxy.conf" ]; then
    ln -s "$NGINX_CONF" /etc/nginx/sites-enabled/ctf-container-proxy.conf
    print_info "Enabled Nginx site"
fi

# Test Nginx configuration
print_info "Testing Nginx configuration..."
if nginx -t 2>&1; then
    print_info "Nginx configuration is valid"
else
    print_error "Nginx configuration test failed"
    exit 1
fi

# Configure firewall
print_info "Configuring firewall..."
if command -v ufw &> /dev/null; then
    # Block external access to container ports
    ufw deny 30000:40000/tcp comment "Block direct container access" || true
    print_info "Blocked external access to container ports (30000-40000)"
fi

# Reload Nginx
print_info "Reloading Nginx..."
systemctl reload nginx
print_success "Nginx reloaded successfully"

# Update .env file
ENV_FILE="$SCRIPT_DIR/.env"
if [ -f "$ENV_FILE" ]; then
    print_info "Updating .env file..."

    # Update or add BASE_URL
    if grep -q "^BASE_URL=" "$ENV_FILE"; then
        sed -i "s|^BASE_URL=.*|BASE_URL=https://$DOMAIN|" "$ENV_FILE"
    else
        echo "" >> "$ENV_FILE"
        echo "# Base URL for email links and container access" >> "$ENV_FILE"
        echo "BASE_URL=https://$DOMAIN" >> "$ENV_FILE"
    fi

    # Remove old CONTAINER_ACCESS_BASE_URL if it exists
    sed -i "/^CONTAINER_ACCESS_BASE_URL=/d" "$ENV_FILE"

    chown "$ACTUAL_USER:$ACTUAL_USER" "$ENV_FILE"
    print_info "Updated BASE_URL in .env"
fi

print_success "Container proxy setup complete!"
echo ""
print_info "Next steps:"
echo "  1. Restart your CTF server to pick up the new BASE_URL:"
echo "     sudo systemctl restart raptors-ctf"
echo ""
echo "  2. Test container access:"
echo "     Deploy a container from the admin panel, then access it via:"
echo "     https://$DOMAIN/challenge/{challenge_id}"
echo ""
echo "  3. Monitor logs:"
echo "     sudo tail -f /var/log/nginx/ctf-containers-access.log"
echo "     sudo tail -f /var/log/nginx/ctf-containers-error.log"
