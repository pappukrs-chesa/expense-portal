#!/bin/bash
# deploy.sh — build the expense-portal and ship dist/ to the server.
#   bash deploy.sh              # build + deploy
#   bash deploy.sh --skip-build # deploy the existing dist/ (no rebuild)
# Needs deploy.config.sh (copy from deploy.config.example.sh) with SSH details.

set -e
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG="$SCRIPT_DIR/deploy.config.sh"

if [ ! -f "$CONFIG" ]; then
  echo -e "${RED}Missing $CONFIG${NC}"
  echo -e "${YELLOW}Create it (copy deploy.config.example.sh) with:${NC}"
  echo '  SERVER_USER="ubuntu"'
  echo '  SERVER_IP="192.168.50.113"'
  echo '  SSH_KEY="$HOME/.ssh/chesa-server.pem"'
  echo '  SERVER_DIR="/var/www/html/expense"'
  echo '  ALB_IP="13.207.230.182"'
  echo '  DOMAIN="expense.chesadentalcare.com"'
  exit 1
fi
source "$CONFIG"
BACKUP_DIR="${SERVER_DIR}_backup"
SSH="ssh -i $SSH_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=20 $SERVER_USER@$SERVER_IP"

# 1) Build
if [ "$1" = "--skip-build" ]; then
  echo -e "${YELLOW}[1/4] Skipping build${NC}"
else
  echo -e "${YELLOW}[1/4] Building (npm run build)...${NC}"
  ( cd "$SCRIPT_DIR" && npm run build )
fi
[ -d "$SCRIPT_DIR/dist" ] || { echo -e "${RED}dist/ not found — build first${NC}"; exit 1; }
[ -f "$SCRIPT_DIR/dist/.htaccess" ] || echo -e "${YELLOW}WARN: dist/.htaccess missing (SPA routing needs it)${NC}"
echo -e "${GREEN}dist/ ready${NC}"

# 2) Ship → backup → swap → health-check → rollback (one remote session; tar over SSH)
echo -e "${YELLOW}[2/4] Deploying to $SERVER_USER@$SERVER_IP:$SERVER_DIR ...${NC}"
OUT=$( cd "$SCRIPT_DIR/dist" && tar czf - . | $SSH "set -e; \
  rm -rf /tmp/expense-dist; mkdir -p /tmp/expense-dist; tar xzf - -C /tmp/expense-dist; \
  if sudo test -f $SERVER_DIR/index.html; then sudo rm -rf $BACKUP_DIR; sudo cp -a $SERVER_DIR $BACKUP_DIR; echo 'BACKED_UP'; else echo 'NO_BACKUP_FIRST_DEPLOY'; fi; \
  sudo mkdir -p $SERVER_DIR; sudo find $SERVER_DIR -mindepth 1 -delete; \
  sudo cp -a /tmp/expense-dist/. $SERVER_DIR/; sudo chown -R www-data:www-data $SERVER_DIR; rm -rf /tmp/expense-dist; \
  if sudo test -f $SERVER_DIR/index.html && sudo test -d $SERVER_DIR/assets; then echo 'HEALTH_OK'; \
  else echo 'HEALTH_FAIL'; if sudo test -d $BACKUP_DIR; then sudo rm -rf $SERVER_DIR; sudo cp -a $BACKUP_DIR $SERVER_DIR; sudo chown -R www-data:www-data $SERVER_DIR; echo 'ROLLED_BACK'; fi; fi" )
echo "$OUT" | sed 's/^/   /'

if echo "$OUT" | grep -q HEALTH_FAIL; then
  echo -e "${RED}[3/4] Health check FAILED — rolled back to previous version${NC}"; exit 1
fi
echo -e "${GREEN}[3/4] Files deployed + health OK${NC}"

# 3) Verify through the ALB
echo -e "${YELLOW}[4/4] Verifying https://$DOMAIN (via ALB)...${NC}"
CODE=$(curl -s -o /dev/null -w "%{http_code}" --resolve "$DOMAIN:443:$ALB_IP" "https://$DOMAIN/" 2>/dev/null || echo 000)
if [ "$CODE" = "200" ]; then
  echo -e "${GREEN}✅ Live — $DOMAIN returns 200${NC}"
else
  echo -e "${YELLOW}Deployed, but ALB check returned $CODE (DNS not pointed yet, or ALB routing) — files are in place.${NC}"
fi
