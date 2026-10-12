#!/usr/bin/env bash
set -Eeuo pipefail
DOMAIN=kaskikotagro.com.np
APP_ROOT=/srv/digital-agriculture
ETC_DIR=/etc/digital-agriculture
DEPLOY_USER="${DEPLOY_USER:-agri-deploy}"
[[ "$EUID" -eq 0 ]] || { echo "Run as root from the VPS provider console." >&2; exit 1; }
[[ -r /etc/os-release ]] || { echo "Cannot identify Linux distribution." >&2; exit 1; }
. /etc/os-release
[[ "$ID" == debian || "$ID" == ubuntu ]] || { echo "Only Debian/Ubuntu supported; got $ID." >&2; exit 1; }
command -v curl >/dev/null || { apt-get update && apt-get install -y ca-certificates curl; }
apt-get update
apt-get install -y ca-certificates curl gnupg openssl ufw openssh-server
systemctl enable --now ssh
if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/$ID/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/%s %s stable\n' "$(dpkg --print-architecture)" "$ID" "$VERSION_CODENAME" > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker
id "$DEPLOY_USER" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash "$DEPLOY_USER"
usermod -aG docker "$DEPLOY_USER"
if ! command -v caddy >/dev/null; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt-get update && apt-get install -y caddy
fi
read -r -p "Paste the SSH public key reserved for GitHub Actions ($DEPLOY_USER): " DEPLOY_PUBLIC_KEY
[[ "$DEPLOY_PUBLIC_KEY" =~ ^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp256)\  ]] || { echo "Valid OpenSSH public key required." >&2; exit 1; }
install -d -m 0700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
touch "/home/$DEPLOY_USER/.ssh/authorized_keys"
grep -qxF "$DEPLOY_PUBLIC_KEY" "/home/$DEPLOY_USER/.ssh/authorized_keys" || printf '%s\n' "$DEPLOY_PUBLIC_KEY" >> "/home/$DEPLOY_USER/.ssh/authorized_keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh/authorized_keys"
chmod 0600 "/home/$DEPLOY_USER/.ssh/authorized_keys"
install -d -m 0755 "$APP_ROOT/releases" "$APP_ROOT/shared/uploads" "$ETC_DIR"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_ROOT"
chown -R 1000:1000 "$APP_ROOT/shared/uploads"
if [[ ! -f "$ETC_DIR/production.env" ]]; then
  read -r -s -p "Enter the initial super-admin password: " INITIAL_ADMIN_PASSWORD
  printf '\n'
  [[ -n "$INITIAL_ADMIN_PASSWORD" ]] || { echo "A bootstrap password is required." >&2; exit 1; }
  DB_ROOT_PASSWORD="$(openssl rand -hex 32)"
  DB_PASSWORD="$(openssl rand -hex 32)"
  JWT_SECRET="$(openssl rand -hex 48)"
  OTP_SECRET="$(openssl rand -hex 32)"
  EXPORT_SECRET="$(openssl rand -hex 32)"
  umask 077
  cat > "$ETC_DIR/production.env" <<ENV
NODE_ENV=production
APP_DATA_DIR=$APP_ROOT/shared
DB_NAME=digital_agriculture
DB_USER=agri_app
DB_PASSWORD=$DB_PASSWORD
DB_ROOT_PASSWORD=$DB_ROOT_PASSWORD
JWT_SECRET=$JWT_SECRET
OTP_SECRET=$OTP_SECRET
EXPORT_SECRET=$EXPORT_SECRET
JWT_EXPIRES_IN=8h
CORS_ORIGIN=https://$DOMAIN
FRONTEND_URL=https://$DOMAIN
PUBLIC_BASE_URL=https://$DOMAIN
TRUST_PROXY_HOPS=1
SUPER_ADMIN_EMAIL=bikashengineering100@gmail.com
SUPER_ADMIN_PHONE=+9779856056205
SUPER_ADMIN_NAME=System Administrator
SA_PASSWORD=$INITIAL_ADMIN_PASSWORD
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
MAIL_FROM=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=
TWILIO_WHATSAPP_CONTENT_SID=
ENV
  chown "$DEPLOY_USER:$DEPLOY_USER" "$ETC_DIR/production.env"
  chmod 0600 "$ETC_DIR/production.env"
else
  echo "Retaining existing private env and database credentials."
fi
if command -v ufw >/dev/null && ufw status | grep -q 'Status: active'; then
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
fi
CADDYFILE=/etc/caddy/Caddyfile
if [[ -f "$CADDYFILE" ]]; then cp -a "$CADDYFILE" "$CADDYFILE.backup.$(date -u +%Y%m%dT%H%M%SZ)"; fi
cat > "$CADDYFILE" <<CADDY
$DOMAIN {
  encode zstd gzip
  @api path /api /api/*
  reverse_proxy @api 127.0.0.1:5001
  reverse_proxy 127.0.0.1:8080
}
www.$DOMAIN {
  redir https://$DOMAIN{uri} permanent
}
CADDY
caddy validate --config "$CADDYFILE" --adapter caddyfile
systemctl enable --now caddy
systemctl reload caddy
HOST_KEY="$(cat /etc/ssh/ssh_host_ed25519_key.pub 2>/dev/null || true)"
if [[ -n "$HOST_KEY" ]]; then printf '\nGitHub secret VPS_KNOWN_HOSTS value:\n%s %s\n' "$DOMAIN" "$HOST_KEY"; fi
printf '\nReady. Deploy user=%s, app=%s, env=%s/production.env\n' "$DEPLOY_USER" "$APP_ROOT" "$ETC_DIR"
printf 'Allow provider-firewall TCP 22, 80, 443. Configure GitHub secrets VPS_HOST, VPS_USER, VPS_DEPLOY_KEY, VPS_KNOWN_HOSTS.\n'
printf 'Add SMTP and Twilio WhatsApp credentials to %s/production.env before OTP delivery is enabled.\n' "$ETC_DIR"
