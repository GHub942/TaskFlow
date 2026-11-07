# Security Policy

This project is a static, client-side HTML page with no server, no backend, and no account system. Tasks, settings, and timer history are kept in browser storage. Its attack surface is intentionally small, but a few things are still worth reporting responsibly.

## Scope

Please report:

- Any way the page could be made to execute untrusted script or inject content beyond its own inline code (e.g. via a crafted URL or hash value).
- Any unexpected external resource. The page currently loads Tailwind CSS, Font Awesome, and the Inter font from third-party CDNs; those resources can observe ordinary network metadata such as the request IP address.
- Any factual error presented as a security claim (for example, a service described as end-to-end encrypted when it is not) — these affect real decisions people make about their privacy and safety.

**Not in scope:**
- Cosmetic UI bugs
- Feature requests or enhancement ideas
- Performance complaints (unless security-relevant)
- Issues requiring backend infrastructure to exploit (we have none)

## Reporting a vulnerability

Open an issue in this repository. If the report involves a factual/privacy-claim error rather than a code vulnerability, a regular issue is fine and doesn't need private disclosure. For a genuine code-level vulnerability, please avoid posting exploit details in a public issue — flag that you have a security report and a maintainer will follow up to receive details privately.

## What to expect

This is a small, volunteer-maintained static site — there's no formal SLA, but reports will be acknowledged and factual/security issues are prioritized over cosmetic ones. Browser storage is not encrypted by this application and may be cleared by the browser; do not store secrets in task descriptions.
