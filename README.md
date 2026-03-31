# Cloud Price Watch

Cloud Price Watch is a lightweight pricing comparison web app for AWS, Azure, GCP, and Alibaba Cloud. It ships as a zero-dependency Node service with a responsive frontend, a normalized pricing catalog, and Azure VM deployment scripts.

The app now treats `Global` and `China` as separate cloud markets so that operator-specific pricing, currencies, and refresh timestamps can be surfaced instead of being mixed into one ranking.

## What is included

- A single Node HTTP server that serves the frontend and JSON APIs.
- A normalized offer catalog for general compute, managed PostgreSQL, object storage, and GPU inference.
- A responsive UI for mobile and desktop visitors.
- Azure VM deployment assets for Nginx reverse proxy and systemd service management.

## Local run

1. Install Node.js 20 or later.
2. Copy `.env.example` to `.env` and adjust values if needed.
3. Run `node server.js`.
4. Visit `http://127.0.0.1:3000`.

## API endpoints

- `GET /api/health`
- `GET /api/metadata`
- `POST /api/compare`

Example request for `POST /api/compare`:

```json
{
  "workload": "general-compute",
  "market": "global",
  "region": "eastus",
  "billingModel": "payg",
  "requirements": {
    "vcpu": 2,
    "memoryGb": 8,
    "storageGb": 100
  }
}
```

Current live connector scope:

- Azure Global retail pricing for `general-compute`
- Azure China (21Vianet) retail pricing for `general-compute`
- Azure Global retail pricing for `managed-postgres`
- Azure China (21Vianet) retail pricing for `managed-postgres`
- Other workloads and vendors continue to use the normalized seed dataset until their market adapters are added

## Azure VM deployment

### 1. Prepare the VM

- Create an Ubuntu 22.04 Azure VM.
- Open inbound ports `22`, `80`, and `443`.
- SSH into the VM and upload this repository.

Run:

```bash
chmod +x scripts/setup-azure-vm.sh
./scripts/setup-azure-vm.sh
```

### 2. Configure environment variables

Create `/opt/cloud-price-watch/shared/.env` on the VM:

```bash
PORT=3000
HOST=127.0.0.1
APP_NAME="Cloud Price Watch"
APP_BASE_URL=https://your-domain.example.com
DEFAULT_CURRENCY=USD
```

### 3. Deploy updates

Default workflow for this project: push to GitHub, SSH to the VM, run `git pull origin main`, restart `cloud-price-watch`, and verify `http://127.0.0.1:3000/api/health` plus the public site.

From Linux or macOS:

```bash
chmod +x scripts/deploy-azure-vm.sh
./scripts/deploy-azure-vm.sh azureuser@your-vm-ip
```

Optional: if the site is already behind a domain or HTTPS, override the public verification URL:

```bash
PUBLIC_HEALTH_URL=https://your-domain.example.com/api/health ./scripts/deploy-azure-vm.sh azureuser@your-vm-ip
```

From Windows PowerShell:

```powershell
.\scripts\deploy-azure-vm.ps1 -Target azureuser@your-vm-ip
```

Optional:

```powershell
.\scripts\deploy-azure-vm.ps1 -Target azureuser@your-vm-ip -PublicHealthUrl https://your-domain.example.com/api/health
```

### 4. Enable HTTPS

After DNS points to the VM, install Certbot and issue a certificate:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.example.com
```

## Recovery

If the public site becomes unavailable, follow:

```text
docs/recovery-runbook.md
```

## Suggested next steps

- Replace the seed catalog with scheduled vendor-specific refresh jobs.
- Add a persistent database for price history and alerting.
- Add authentication if you want private team workspaces or saved comparison presets.
