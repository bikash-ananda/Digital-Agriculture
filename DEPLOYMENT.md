# Production deployment

The production stack uses Docker Compose for MySQL, the API and the static frontend. Caddy terminates HTTPS on the VPS and proxies only to localhost-bound application ports. MySQL has no public port, and its data volume survives application releases.

## One-time VPS setup

1. The root, `www`, and wildcard A records should point to `169.58.25.131`. Allow inbound TCP 22, 80, and 443 in the VPS provider firewall.
2. If SSH times out, open the provider's web console for the VPS and run these commands as root. Then allow TCP 22 in the provider firewall and check `Test-NetConnection 169.58.25.131 -Port 22` in PowerShell.

~~~bash
apt-get update
apt-get install -y openssh-server
systemctl enable --now ssh
ss -ltnp | grep ':22'
~~~

3. Generate a separate deploy key on the Windows computer:

~~~
New-Item -ItemType Directory -Force "$HOME\.ssh" | Out-Null
ssh-keygen -t ed25519 -C "Digital Agriculture deploy" -f "$HOME\.ssh\digital-agriculture-deploy"
~~~

4. Once SSH is reachable, copy scripts/provision-vps.sh to the VPS and run it as root. It installs Docker Compose, Caddy, and OpenSSH if needed, creates agri-deploy, preserves the existing Caddyfile as a backup, configures HTTPS for the root domain and redirects `www` to it, and creates a private production environment file. Paste the deploy key's `.pub` contents when prompted. Enter the initial super-admin password at the hidden prompt.
5. Set SMTP and Twilio WhatsApp values in `/etc/digital-agriculture/production.env`. Without those provider credentials, email and WhatsApp codes cannot be delivered.
6. Add these repository Actions secrets under Settings → Secrets and variables → Actions:
   - VPS_HOST: kaskikotagro.com.np
   - VPS_USER: agri-deploy
   - VPS_DEPLOY_KEY: contents of digital-agriculture-deploy (private key)
   - VPS_KNOWN_HOSTS: the verified line printed by the VPS setup script
   - VPS_SSH_PORT: optional; defaults to 22

The deploy account needs the matching public key in authorized_keys. Verify the host-key fingerprint through the provider console before trusting it.

## Continuous deployment

After the workflow is pushed to main and the repository secrets are set, every push to main uploads a release, builds the images on the VPS, applies pending migrations and reference data, creates the super-admin only if the email is absent, and checks /api/health. Manual runs are available from Actions → Deploy Digital Agriculture → Run workflow.

The initial super-admin is bikashengineering100@gmail.com with the mobile number configured in the private environment. The first login requires a password change. Automatic deployments do not reset an existing account password.

Keep /etc/digital-agriculture/production.env private (mode 600) and keep the Docker database volume. Back up the volume before manually changing database credentials or performing database maintenance.
