#!/bin/bash

# CTF Platform Interactive Setup Script
# Creates .env file, generates secrets, and prepares the database

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== CTF Platform Interactive Setup ===${NC}"
echo ""

# Check if .env already exists
if [ -f .env ]; then
    echo -e "${YELLOW}Warning: .env file already exists${NC}"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Setup cancelled. Using existing .env file.${NC}"
        USE_EXISTING_ENV=true
    else
        USE_EXISTING_ENV=false
    fi
else
    USE_EXISTING_ENV=false
fi

# Interactive .env creation
if [ "$USE_EXISTING_ENV" = false ]; then
    echo -e "${BLUE}Let's configure your CTF platform...${NC}"
    echo ""

    # Database Configuration
    echo -e "${GREEN}--- Database Configuration ---${NC}"
    read -p "PostgreSQL host (default: localhost): " DB_HOST
    DB_HOST=${DB_HOST:-localhost}

    read -p "PostgreSQL port (default: 5432): " DB_PORT
    DB_PORT=${DB_PORT:-5432}

    read -p "Database name (default: ctf_platform): " DB_NAME
    DB_NAME=${DB_NAME:-ctf_platform}

    read -p "Database user (default: ctf_user): " DB_USER
    DB_USER=${DB_USER:-ctf_user}

    read -sp "Database password: " DB_PASS
    echo
    if [ -z "$DB_PASS" ]; then
        echo -e "${YELLOW}Generating random database password...${NC}"
        DB_PASS=$(openssl rand -hex 16)
        echo -e "${YELLOW}Generated password: ${DB_PASS}${NC}"
    fi

    # URL-encode the password for use in DATABASE_URL
    # This handles special characters like @, #, !, $, etc.
    DB_PASS_ENCODED=$(printf '%s' "$DB_PASS" | jq -sRr @uri)

    DATABASE_URL="postgresql://${DB_USER}:${DB_PASS_ENCODED}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

    echo ""
    echo -e "${GREEN}--- Session Configuration ---${NC}"
    echo -e "${YELLOW}Generating secure session secret...${NC}"
    SESSION_SECRET=$(openssl rand -hex 32)
    echo -e "${GREEN}Session secret generated${NC}"

    echo ""
    echo -e "${GREEN}--- Admin Account ---${NC}"
    read -p "Admin username (default: admin): " ADMIN_USERNAME
    ADMIN_USERNAME=${ADMIN_USERNAME:-admin}

    read -sp "Admin password: " ADMIN_PASSWORD
    echo
    while [ -z "$ADMIN_PASSWORD" ]; do
        echo -e "${RED}Admin password cannot be empty${NC}"
        read -sp "Admin password: " ADMIN_PASSWORD
        echo
    done

    echo ""
    echo -e "${GREEN}--- Application Configuration ---${NC}"
    read -p "Server port (default: 5001): " PORT
    PORT=${PORT:-5001}

    read -p "Environment (development/production, default: development): " NODE_ENV
    NODE_ENV=${NODE_ENV:-development}

    # Create .env file
    echo ""
    echo -e "${GREEN}Creating .env file...${NC}"
    cat > .env << EOF
# ============================================================================
# DATABASE CONFIGURATION
# ============================================================================
DATABASE_URL=${DATABASE_URL}

# ============================================================================
# SESSION CONFIGURATION
# ============================================================================
# Secret key for session encryption (auto-generated)
SESSION_SECRET=${SESSION_SECRET}

# ============================================================================
# ADMIN BOOTSTRAP
# ============================================================================
# These credentials are used to create the initial admin user
ADMIN_USERNAME=${ADMIN_USERNAME}
ADMIN_PASSWORD=${ADMIN_PASSWORD}

# ============================================================================
# APPLICATION CONFIGURATION
# ============================================================================
PORT=${PORT}
NODE_ENV=${NODE_ENV}

# ============================================================================
# OPTIONAL CONFIGURATION
# ============================================================================
# Upload directory (default: ./uploads)
# UPLOAD_DIR=./uploads

# Log level (default: info)
# LOG_LEVEL=info
EOF

    echo -e "${GREEN}.env file created successfully!${NC}"
    echo ""
else
    # Load existing .env
    set -a
    source .env
    set +a

    # Parse DATABASE_URL to extract components
    DB_USER=$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
    DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
    DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):.*|\1|p')
    DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
    DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
fi

# Display configuration summary
echo -e "${BLUE}=== Configuration Summary ===${NC}"
echo "Database:"
echo "  Host: ${DB_HOST}"
echo "  Port: ${DB_PORT}"
echo "  Database: ${DB_NAME}"
echo "  User: ${DB_USER}"
echo ""
echo "Application:"
echo "  Port: ${PORT:-5001}"
echo "  Environment: ${NODE_ENV:-development}"
echo ""

# Confirm before proceeding
read -p "Continue with database setup? (Y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Nn]$ ]]; then
    echo -e "${YELLOW}Setup stopped. You can run this script again when ready.${NC}"
    exit 0
fi

# Check if PostgreSQL is running
echo ""
echo -e "${GREEN}=== Database Setup ===${NC}"
if ! command -v psql &> /dev/null; then
    echo -e "${RED}Error: PostgreSQL client (psql) not found.${NC}"
    echo ""
    echo -e "${YELLOW}Install PostgreSQL and then run these commands manually:${NC}"
    echo ""
    echo -e "${BLUE}sudo -u postgres psql << EOF"
    echo "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
    echo "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
    echo "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
    echo "\c ${DB_NAME}"
    echo "GRANT ALL ON SCHEMA public TO ${DB_USER};"
    echo "ALTER DATABASE ${DB_NAME} OWNER TO ${DB_USER};"
    echo -e "EOF${NC}"
    echo ""
    echo -e "${YELLOW}Then run:${NC}"
    echo -e "${BLUE}npm install${NC}"
    echo -e "${BLUE}npm run db:push${NC}"
    exit 1
fi

# Create database and user using sudo -u postgres
echo -e "${GREEN}Creating PostgreSQL user and database...${NC}"

# Check if user exists
USER_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" 2>/dev/null || echo "")

if [ "$USER_EXISTS" = "1" ]; then
    echo -e "${YELLOW}User '${DB_USER}' already exists${NC}"
else
    echo "Creating user '${DB_USER}'..."
    sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
    echo -e "${GREEN}User '${DB_USER}' created${NC}"
fi

# Check if database exists
DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null || echo "")

if [ "$DB_EXISTS" = "1" ]; then
    echo -e "${YELLOW}Database '${DB_NAME}' already exists${NC}"
else
    echo "Creating database '${DB_NAME}'..."
    sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
    echo -e "${GREEN}Database '${DB_NAME}' created${NC}"
fi

# Grant privileges
echo "Granting privileges..."
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL ON SCHEMA public TO ${DB_USER};"
sudo -u postgres psql -d "${DB_NAME}" -c "ALTER DATABASE ${DB_NAME} OWNER TO ${DB_USER};"

echo -e "${GREEN}Database setup complete!${NC}"
echo ""

# Create uploads directory if it doesn't exist
UPLOAD_DIR=${UPLOAD_DIR:-./uploads}
if [ ! -d "$UPLOAD_DIR" ]; then
    echo "Creating uploads directory: ${UPLOAD_DIR}"
    mkdir -p "${UPLOAD_DIR}"
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo -e "${GREEN}Installing dependencies...${NC}"
    npm install
    echo ""
fi

# Run database schema push
echo -e "${GREEN}=== Applying Database Schema ===${NC}"
echo "Running: npm run db:push"
echo ""
npm run db:push

echo ""
echo -e "${GREEN}=== Setup Complete! ===${NC}"
echo ""
echo -e "${BLUE}Quick Reference:${NC}"
echo ""
echo "Database Commands:"
echo "  ${GREEN}npm run db:push${NC}      - Push schema changes to database (development)"
echo "  ${GREEN}npm run db:generate${NC}  - Generate migration files"
echo "  ${GREEN}npm run db:migrate${NC}   - Apply migrations (production)"
echo "  ${GREEN}npm run db:studio${NC}    - Open Drizzle Studio (database GUI)"
echo ""
echo "Development:"
echo "  ${GREEN}npm run dev${NC}          - Start development server"
echo "  ${GREEN}npm run build${NC}        - Build for production"
echo "  ${GREEN}npm start${NC}            - Run production server"
echo ""
echo "Admin Credentials:"
echo "  Username: ${ADMIN_USERNAME}"
echo "  Password: (check your .env file)"
echo ""
echo -e "${YELLOW}Important:${NC}"
echo "  - Change the admin password after first login"
echo "  - Keep your .env file secure and never commit it to version control"
echo "  - For production, use 'npm run db:generate' then 'npm run db:migrate'"
echo ""
