# InfinityFree deployment status

## Important hosting limitation

InfinityFree can serve the files in `Server/public`, but it cannot run this project's Node.js/Express server, Python scraper, persistent sessions, or `node-cron` jobs. Uploading the public folder alone will therefore provide only the static pages; login, registration, saved jobs, applications, database access, scraping, and email notifications will not work.

The secure Express version remains suitable for a Node-capable host. For a fully functional InfinityFree deployment, the API routes and session layer must be ported to PHP/MySQL and the scraper/email jobs must be moved to an external scheduler or run manually. This repository is not claiming that unsupported Node routes work on InfinityFree.

## Static frontend upload

1. Create an InfinityFree account and an HTTPS-enabled site.
2. Upload the contents of `Server/public` to the site's `htdocs` directory using the InfinityFree file manager or FTP.
3. Do not upload `.env`, `node_modules`, `server-log.txt`, or any server-side source files.
4. Confirm the site uses HTTPS before testing it.

The included `.htaccess` disables directory listing, blocks common secret/log files, and adds baseline browser security headers.

## Secure Node deployment

For the current full application, use a host that supports a persistent Node.js process and MySQL. Copy `.env.example` to a secret-managed environment and provide:

- a random `SESSION_SECRET` of at least 32 characters;
- production database credentials;
- an HTTPS `ALLOWED_ORIGIN`;
- a random `INTERNAL_JOB_TOKEN`;
- SMTP credentials stored outside source control.

The `/test-email` endpoint has been removed. The scraper trigger is now a protected `POST /api/jobs` endpoint requiring `X-Internal-Job-Token`; do not expose that token in browser code.

The Gmail app password previously present in `.env` was removed. Rotate that credential immediately because it was exposed in the project files.
