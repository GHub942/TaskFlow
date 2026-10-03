# Security Policy

## Supported Versions

We provide security updates and patches for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |
| < 1.0   | :x:                |

---

## Reporting a Vulnerability

We take the security of TaskMaster Pro seriously. Since TaskMaster Pro runs client-side inside the user's web browser and relies solely on `localStorage` without external server backends, security risks are minimal. However, if you discover a security vulnerability or Cross-Site Scripting (XSS) exploit within the client side logic, please follow these steps:

1. **Do not create a public GitHub issue** for security vulnerabilities.
2. Send a private security report detailing the issue and steps to reproduce it to `security@taskmaster-pro.local` (or open a private security advisory on GitHub).
3. We will review your report within **48 hours** and provide an estimated timeline for remediation.

---

## Security Best Practices for Users

- **Data Privacy:** All task data remains stored locally on your device (`localStorage`). Never paste sensitive credentials or passwords directly into task details.
- **JSON Import Security:** Only import JSON backup files that you have generated yourself or obtained from trusted sources.