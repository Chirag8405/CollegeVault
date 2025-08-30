#!/bin/bash

# Netlify Deployment Script for College Vault
# Developed by Chirag Poornamath

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="College Vault"
DEVELOPER="Chirag Poornamath"
NODE_VERSION="18"
DOCKER_IMAGE="chiragpoornamath/college-document-vault"

# Functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

show_banner() {
    echo -e "${BLUE}"
    echo "=================================================="
    echo "   $PROJECT_NAME - Deployment Script"
    echo "   Developed by: $DEVELOPER"
    echo "=================================================="
    echo -e "${NC}"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Node.js version
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    local node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$node_version" -lt "$NODE_VERSION" ]; then
        log_error "Node.js version $NODE_VERSION or higher is required"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    fi
    
    # Check Docker (optional)
    if command -v docker &> /dev/null; then
        log_success "Docker is available"
        DOCKER_AVAILABLE=true
    else
        log_warning "Docker is not available (optional)"
        DOCKER_AVAILABLE=false
    fi
    
    # Check Netlify CLI
    if ! command -v netlify &> /dev/null; then
        log_warning "Netlify CLI not found. Installing..."
        npm install -g netlify-cli@latest
    fi
    
    log_success "Prerequisites check completed"
}

setup_environment() {
    log_info "Setting up environment..."
    
    # Check if .env.production exists
    if [ ! -f ".env.production" ]; then
        if [ -f ".env.production.example" ]; then
            log_info "Creating .env.production from example..."
            cp .env.production.example .env.production
            log_warning "Please edit .env.production with your actual values"
            read -p "Press Enter to continue after editing .env.production..."
        else
            log_error ".env.production.example not found"
            exit 1
        fi
    fi
    
    # Validate environment variables
    source .env.production
    
    required_vars=("SMTP_HOST" "SMTP_USER" "SMTP_PASS" "TWILIO_ACCOUNT_SID" "TWILIO_AUTH_TOKEN" "TWILIO_PHONE_NUMBER")
    missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        log_error "Missing required environment variables: ${missing_vars[*]}"
        log_info "Please configure these variables in .env.production"
        exit 1
    fi
    
    log_success "Environment setup completed"
}

install_dependencies() {
    log_info "Installing dependencies..."
    
    # Clean install
    if [ -d "node_modules" ]; then
        rm -rf node_modules
    fi
    
    if [ -f "package-lock.json" ]; then
        rm package-lock.json
    fi
    
    npm install
    
    log_success "Dependencies installed"
}

run_tests() {
    log_info "Running tests and quality checks..."
    
    # Type checking
    npm run typecheck
    
    # Tests
    npm test
    
    # Security audit
    npm audit --audit-level=moderate
    
    log_success "All tests passed"
}

build_application() {
    log_info "Building application..."
    
    # Set production environment
    export NODE_ENV=production
    
    # Build the application
    npm run build
    
    # Verify build output
    if [ ! -d "dist/spa" ]; then
        log_error "Client build failed - dist/spa directory not found"
        exit 1
    fi
    
    if [ ! -d "dist/server" ]; then
        log_error "Server build failed - dist/server directory not found"
        exit 1
    fi
    
    log_success "Application built successfully"
}

build_docker_image() {
    if [ "$DOCKER_AVAILABLE" = true ]; then
        log_info "Building Docker image..."
        
        # Build the image
        docker build -t "$DOCKER_IMAGE:latest" .
        
        # Tag with timestamp
        local timestamp=$(date +%Y%m%d-%H%M%S)
        docker tag "$DOCKER_IMAGE:latest" "$DOCKER_IMAGE:$timestamp"
        
        log_success "Docker image built: $DOCKER_IMAGE:latest"
        
        # Optional: Push to registry
        read -p "Push Docker image to registry? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker push "$DOCKER_IMAGE:latest"
            docker push "$DOCKER_IMAGE:$timestamp"
            log_success "Docker image pushed to registry"
        fi
    else
        log_warning "Skipping Docker build (Docker not available)"
    fi
}

setup_netlify() {
    log_info "Setting up Netlify configuration..."
    
    # Login to Netlify (if not already logged in)
    if ! netlify status &> /dev/null; then
        log_info "Please login to Netlify..."
        netlify login
    fi
    
    # Initialize site if needed
    if [ ! -f ".netlify/state.json" ]; then
        log_info "Initializing Netlify site..."
        netlify init
    fi
    
    log_success "Netlify configuration ready"
}

set_environment_variables() {
    log_info "Setting Netlify environment variables..."
    
    # Source the production environment file
    source .env.production
    
    # Set environment variables on Netlify
    netlify env:set NODE_ENV "production"
    netlify env:set SMTP_HOST "$SMTP_HOST"
    netlify env:set SMTP_PORT "$SMTP_PORT"
    netlify env:set SMTP_USER "$SMTP_USER"
    netlify env:set SMTP_PASS "$SMTP_PASS"
    netlify env:set TWILIO_ACCOUNT_SID "$TWILIO_ACCOUNT_SID"
    netlify env:set TWILIO_AUTH_TOKEN "$TWILIO_AUTH_TOKEN"
    netlify env:set TWILIO_PHONE_NUMBER "$TWILIO_PHONE_NUMBER"
    
    # Generate JWT secret if not provided
    if [ -z "$JWT_SECRET" ]; then
        JWT_SECRET=$(openssl rand -base64 48)
        netlify env:set JWT_SECRET "$JWT_SECRET"
        log_info "Generated new JWT secret"
    else
        netlify env:set JWT_SECRET "$JWT_SECRET"
    fi
    
    log_success "Environment variables configured on Netlify"
}

deploy_to_netlify() {
    log_info "Deploying to Netlify..."
    
    # Deploy to production
    netlify deploy \
        --prod \
        --dir=dist/spa \
        --functions=netlify/functions \
        --message="Production deployment by $DEVELOPER - $(date)"
    
    # Get the deployment URL
    local site_url=$(netlify status --json | jq -r '.site.url')
    
    log_success "Deployment completed!"
    log_info "Site URL: $site_url"
    
    # Wait a moment for deployment to propagate
    sleep 10
    
    # Health check
    log_info "Running health check..."
    if curl -f "$site_url/api/health" > /dev/null 2>&1; then
        log_success "Health check passed!"
    else
        log_warning "Health check failed - please verify manually"
    fi
    
    echo -e "${GREEN}"
    echo "=================================================="
    echo "   🚀 DEPLOYMENT SUCCESSFUL! 🚀"
    echo "=================================================="
    echo "   Site URL: $site_url"
    echo "   API Health: $site_url/api/health"
    echo "   Status: $site_url/api/status"
    echo "=================================================="
    echo -e "${NC}"
}

run_post_deployment_tests() {
    log_info "Running post-deployment tests..."
    
    local site_url=$(netlify status --json | jq -r '.site.url')
    
    # Test API endpoints
    local endpoints=("/api/health" "/api/status")
    
    for endpoint in "${endpoints[@]}"; do
        log_info "Testing $endpoint..."
        if curl -f "$site_url$endpoint" > /dev/null 2>&1; then
            log_success "$endpoint is responding"
        else
            log_error "$endpoint is not responding"
        fi
    done
    
    # Optional: Run Lighthouse performance test
    if command -v lighthouse &> /dev/null; then
        log_info "Running Lighthouse performance test..."
        lighthouse "$site_url" --output=json --output-path=./lighthouse-results.json --chrome-flags="--headless" || true
        
        if [ -f "lighthouse-results.json" ]; then
            local performance_score=$(cat lighthouse-results.json | jq '.categories.performance.score * 100')
            log_info "Performance Score: $performance_score%"
        fi
    fi
    
    log_success "Post-deployment tests completed"
}

cleanup() {
    log_info "Cleaning up..."
    
    # Remove temporary files
    rm -f lighthouse-results.json
    
    # Clean Docker images (keep latest 3)
    if [ "$DOCKER_AVAILABLE" = true ]; then
        docker images "$DOCKER_IMAGE" --format "table {{.Repository}}:{{.Tag}}\t{{.CreatedAt}}" | \
        tail -n +2 | sort -k2 -r | tail -n +4 | awk '{print $1}' | \
        xargs -r docker rmi 2>/dev/null || true
    fi
    
    log_success "Cleanup completed"
}

# Main deployment flow
main() {
    show_banner
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            --skip-docker)
                DOCKER_AVAILABLE=false
                shift
                ;;
            --preview)
                PREVIEW_ONLY=true
                shift
                ;;
            -h|--help)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --skip-tests    Skip running tests"
                echo "  --skip-docker   Skip Docker build"
                echo "  --preview       Deploy as preview only"
                echo "  -h, --help      Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Run deployment steps
    check_prerequisites
    setup_environment
    install_dependencies
    
    if [ "$SKIP_TESTS" != true ]; then
        run_tests
    fi
    
    build_application
    build_docker_image
    setup_netlify
    set_environment_variables
    
    if [ "$PREVIEW_ONLY" = true ]; then
        log_info "Deploying as preview..."
        netlify deploy \
            --dir=dist/spa \
            --functions=netlify/functions \
            --message="Preview deployment by $DEVELOPER - $(date)"
    else
        deploy_to_netlify
        run_post_deployment_tests
    fi
    
    cleanup
    
    log_success "Deployment script completed successfully!"
}

# Run the main function
main "$@"
