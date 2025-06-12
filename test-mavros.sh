#!/bin/bash
# websocket-diagnostic.sh - Production WebSocket Diagnostic Tool
# Identifies exact cause of external WebSocket connectivity issues

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

EXTERNAL_IP="3.111.215.70"
INTERNAL_IP="localhost"
WS_PORT="4002"

log() { echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; }
warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗"
echo -e "║            WebSocket Production Diagnostic Tool              ║"
echo -e "╚══════════════════════════════════════════════════════════════╝${NC}\n"

# 1. Container Port Binding Analysis
log "1. Analyzing Docker port bindings..."
container_ports=$(docker port flyos-realtime-service-1 2>/dev/null)
if [ -n "$container_ports" ]; then
    echo "$container_ports"
    if echo "$container_ports" | grep -q "0.0.0.0:$WS_PORT"; then
        success "Container is bound to all interfaces (0.0.0.0:$WS_PORT)"
    else
        error "Container is NOT bound to external interface"
        echo "Current binding: $container_ports"
    fi
else
    error "Cannot get port information for realtime-service container"
fi

# 2. Service Binding Analysis
log "2. Checking service binding inside container..."
binding_info=$(docker exec flyos-realtime-service-1 netstat -tlnp 2>/dev/null | grep ":$WS_PORT")
if [ -n "$binding_info" ]; then
    echo "Service binding: $binding_info"
    if echo "$binding_info" | grep -q "0.0.0.0:$WS_PORT"; then
        success "Service is listening on all interfaces (0.0.0.0:$WS_PORT)"
    elif echo "$binding_info" | grep -q "127.0.0.1:$WS_PORT"; then
        error "Service is only listening on localhost (127.0.0.1:$WS_PORT)"
        warning "This is the ROOT CAUSE - service needs to bind to 0.0.0.0"
    else
        warning "Unusual binding detected: $binding_info"
    fi
else
    error "Service is not listening on port $WS_PORT inside container"
fi

# 3. Host Network Analysis
log "3. Checking host network ports..."
host_ports=$(netstat -tlnp 2>/dev/null | grep ":$WS_PORT")
if [ -n "$host_ports" ]; then
    echo "Host ports: $host_ports"
    if echo "$host_ports" | grep -q "0.0.0.0:$WS_PORT"; then
        success "Host is listening on all interfaces"
    else
        warning "Host binding may be restricted"
    fi
else
    error "Host is not listening on port $WS_PORT"
fi

# 4. Internal Connectivity Test
log "4. Testing internal connectivity..."
if timeout 3 bash -c "</dev/tcp/$INTERNAL_IP/$WS_PORT" 2>/dev/null; then
    success "Internal WebSocket port ($INTERNAL_IP:$WS_PORT) is reachable"
else
    error "Internal WebSocket port ($INTERNAL_IP:$WS_PORT) is NOT reachable"
fi

# 5. External Connectivity Test
log "5. Testing external connectivity..."
if timeout 3 bash -c "</dev/tcp/$EXTERNAL_IP/$WS_PORT" 2>/dev/null; then
    success "External WebSocket port ($EXTERNAL_IP:$WS_PORT) is reachable"
    EXTERNAL_REACHABLE=true
else
    error "External WebSocket port ($EXTERNAL_IP:$WS_PORT) is NOT reachable"
    EXTERNAL_REACHABLE=false
fi

# 6. Firewall Analysis
log "6. Analyzing firewall rules..."
if command -v ufw >/dev/null 2>&1; then
    ufw_status=$(ufw status 2>/dev/null)
    if echo "$ufw_status" | grep -q "Status: active"; then
        echo "UFW Status: Active"
        if echo "$ufw_status" | grep -q "$WS_PORT"; then
            success "Port $WS_PORT is allowed in UFW"
        else
            warning "Port $WS_PORT not explicitly allowed in UFW"
            echo "UFW rules for port $WS_PORT:"
            ufw status | grep "$WS_PORT" || echo "No rules found"
        fi
    else
        echo "UFW Status: Inactive"
    fi
else
    echo "UFW not installed"
fi

# 7. AWS Security Group Check
log "7. Testing AWS Security Group (external HTTP access)..."
http_response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "http://$EXTERNAL_IP:$WS_PORT/health" 2>/dev/null)
if [ "$http_response" = "200" ]; then
    success "HTTP access to external IP works (AWS Security Group allows $WS_PORT)"
elif [ "$http_response" = "000" ]; then
    error "Cannot reach external IP at all (AWS Security Group likely blocks $WS_PORT)"
    warning "You need to add inbound rule in AWS Security Group for port $WS_PORT"
else
    warning "External IP reachable but HTTP response: $http_response"
fi

# 8. Container Environment Analysis
log "8. Checking container environment configuration..."
container_env=$(docker exec flyos-realtime-service-1 env | grep -E "(HOST|PORT|BIND)" 2>/dev/null)
if [ -n "$container_env" ]; then
    echo "Environment variables:"
    echo "$container_env"
else
    warning "No HOST/PORT/BIND environment variables found"
fi

# 9. Socket.IO Server Configuration Check
log "9. Analyzing Socket.IO server configuration..."
server_config=$(docker exec flyos-realtime-service-1 cat /app/dist/app.js 2>/dev/null | grep -A 5 -B 5 "listen\|host\|bind" | head -20)
if [ -n "$server_config" ]; then
    echo "Server configuration snippet:"
    echo "$server_config"
else
    warning "Cannot analyze server configuration"
fi

# 10. Production Fix Recommendation
echo -e "\n${BLUE}=== PRODUCTION FIX RECOMMENDATION ===${NC}"

if [ "$EXTERNAL_REACHABLE" = true ]; then
    success "WebSocket is already accessible externally. Issue may be intermittent."
else
    # Determine the exact fix needed
    if echo "$binding_info" | grep -q "127.0.0.1:$WS_PORT"; then
        error "ROOT CAUSE: Service is binding to localhost only"
        echo -e "\n${YELLOW}REQUIRED FIX:${NC}"
        echo "1. Edit services/realtime-service/src/app.ts"
        echo "2. Change server.listen(PORT, ...) to server.listen(PORT, '0.0.0.0', ...)"
        echo "3. Rebuild container: docker-compose build realtime-service"
        echo "4. Restart: docker-compose up -d realtime-service"
    elif [ "$http_response" = "000" ]; then
        error "ROOT CAUSE: AWS Security Group blocks port $WS_PORT"
        echo -e "\n${YELLOW}REQUIRED FIX:${NC}"
        echo "1. Go to AWS Console → EC2 → Security Groups"
        echo "2. Find security group for instance $EXTERNAL_IP"
        echo "3. Add inbound rule: Type=Custom TCP, Port=$WS_PORT, Source=0.0.0.0/0"
        echo "4. No container restart needed"
    else
        warning "Multiple potential issues detected"
        echo -e "\n${YELLOW}RECOMMENDED FIXES (in order):${NC}"
        echo "1. Fix AWS Security Group (add port $WS_PORT)"
        echo "2. Fix service binding (bind to 0.0.0.0 instead of 127.0.0.1)"
        echo "3. Rebuild and restart realtime-service container"
    fi
fi

echo -e "\n${BLUE}=== DIAGNOSTIC COMPLETE ===${NC}"