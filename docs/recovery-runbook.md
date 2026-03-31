# Cloud Price Watch Recovery Runbook

## Purpose

Use this runbook when the public site or API is unavailable and you need to restore service on the Azure VM quickly.

## Public checks

From any machine with network access, verify:

```bash
curl -fsS http://20.255.57.221/api/health
```

Expected result:

- JSON response with `"ok": true`
- `"service": "Cloud Price Watch"`

## SSH access

Example:

```bash
ssh -i /path/to/cloud-price-watch-vm_key.pem azureuser@20.255.57.221
```

## On-VM diagnosis

Check current time, uptime, and service state:

```bash
date
uptime
systemctl status cloud-price-watch --no-pager
systemctl status nginx --no-pager
```

Check local health endpoint:

```bash
curl -fsS http://127.0.0.1:3000/api/health
```

## Standard recovery steps

Update code and restart the app:

```bash
cd /opt/cloud-price-watch/current
git pull --ff-only origin main
sudo systemctl daemon-reload
sudo systemctl restart cloud-price-watch
sudo systemctl restart nginx
```

Verify again:

```bash
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS http://20.255.57.221/api/health
```

## Configuration references

- App directory: `/opt/cloud-price-watch/current`
- Shared environment file: `/opt/cloud-price-watch/shared/.env`
- Systemd unit: `/etc/systemd/system/cloud-price-watch.service`
- Nginx config: `/etc/nginx/sites-available/cloud-price-watch.conf`

## Notes

- Current VM timezone: `Asia/Shanghai`
- Current runtime user: `azureuser`
- Default deployment workflow: push to GitHub, SSH to the VM, `git pull`, restart, verify health
