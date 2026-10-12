# Production deployment

The production stack uses Docker Compose for MySQL, the API and the static frontend. Caddy terminates HTTPS on the VPS and proxies only to localhost-bound application ports. MySQL has no public port, and its data volume survives application releases.

## One-time VPS setup

1. In the VPS provider panel, enable SSH and allow inbound TCP 22, 80 and 443. The domain A record should point to 169.58.25.131.
2. Generate a separate deploy key on the Windows computer:

~~~
ssh-keygen -t ed25519 -C "Digital Agriculture deploy" -f "$HOME\.ssh\digital-agriculture-deploy"
~~~

3. Once SSH is reachable, copy scripts/provision-vps.sh to the VPS and run it as root. It installs Docker Compose and Caddy if needed, creates agri-deploy, preserves the existing Caddyfile as a backup, configures HTTPS routing and creates a private production environment file. Paste the deploy key's .pub contents when prompted. Enter the initial super-admin password at the hidden prompt.
4. Set SMTP and Twilio WhatsApp values in /etc/digital-agriculture/production.env. Without those provider credentials, email and WhatsApp codes cannot be delivered.
5. Add these repository Actions secrets under Settings → Secrets and variables → Actions:
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