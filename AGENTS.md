# Project Working Notes

## Repository

- Primary local repository path: `C:\Users\v-jianli1\.codex\cloud-price-watch`
- GitHub repository: `https://github.com/VincentLi0728/cloud-price-watch`

## Product Direction

- Current phase: build a website first.
- Current cloud scope: Azure, AWS, and GCP.
- Future phase: add an app experience after the website MVP is working.
- Future scope can expand to more cloud vendors after the first website release.

## Collaboration Defaults

- When working on the cloud pricing project, use this repository as the default workspace.
- Keep the website as the primary delivery target unless the user explicitly shifts priority to the app.
- Prefer changes that keep deployment simple for an Azure VM.
- Default deployment workflow: push to GitHub, SSH to the Azure VM, run `git pull`, restart `cloud-price-watch`, and verify health checks.
- Default VM runtime user: `azureuser` so manual SSH maintenance and `git pull` remain simple during the website MVP phase.
- Future option: the VM can be migrated later to a dedicated service account such as `www-data` if deployment becomes more automated or security boundaries need to tighten.

## How To Evolve This File

- Update this file whenever product scope, deployment target, or collaboration workflow changes.
- If app work starts later, add the app plan here instead of replacing the website-first priority unless the user decides otherwise.
- If new cloud vendors are added, list them here so future sessions can recover the latest agreed scope quickly.
