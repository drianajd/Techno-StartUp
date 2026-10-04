# Techno-StartUp

Techno-StartUp is an Express/MySQL internship-matching app. The Express server serves
both the website and its API. For access over Radmin VPN, run the server on the host
PC and have other VPN members open the host PC's Radmin VPN IPv4 address.

## Requirements

- Windows 10/11 host with Node.js 22 LTS and npm
- Python 3.11, including the Python Launcher (`py`)
- MySQL 8 or compatible MySQL server
- Radmin VPN installed and connected on the host and client PCs

## Host setup

1. Create a MySQL database and tables by running [`dbSchema.txt`](./dbSchema.txt)
   in MySQL Workbench or the MySQL command line. The script creates the `grantify`
   database.
   If you already have an older `grantify` database, run
   [`dbMigrations/001_add_internship_title_location.sql`](./dbMigrations/001_add_internship_title_location.sql)
   once against that database before starting the server.
2. Copy `.env.example` to `.env`. Set `DB_USER`, `DB_PASS`, and `SESSION_SECRET`.
   Generate a session secret with:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
   ```

   Keep `.env` private; it is ignored by Git.
3. Install the Node dependencies from the project root:

   ```powershell
   npm ci
   ```

4. Install the Python scraper dependencies and Chromium:

   ```powershell
   py -3.11 -m venv .venv
   .\.venv\Scripts\python.exe -m pip install -r requirements.txt
   .\.venv\Scripts\python.exe -m playwright install chromium
   ```

   Set `PYTHON_EXECUTABLE` in `.env` to the absolute path of
   `.venv\Scripts\python.exe` if `py -3.11` is not available or you want the
   scraper to use this virtual environment.

5. Check the server JavaScript and start the app:

   ```powershell
   npm run check
   npm start
   ```

   The first start also runs the scraper. The app then scrapes jobs and checks for
   matching email notifications every 30 minutes.

## Radmin VPN access

- Keep `HOST=0.0.0.0` and choose an available `PORT` (default `5500`).
- On the host PC, allow inbound TCP traffic to that port in Windows Defender
  Firewall. Restrict the rule to the Private profile and Radmin VPN network if
  Windows offers that option.
- Have clients connect to `http://26.205.99.251:5500` (not `localhost`:
  `localhost` always refers to each client's own PC). This assumes
  `26.205.99.251` is the Radmin VPN address assigned to the host PC.
- `SESSION_COOKIE_SECURE=false` is needed only for HTTP over a private Radmin VPN.
  Radmin VPN encrypts the tunnel, but access is still limited to trusted VPN
  members. Do not expose this HTTP configuration directly to the public internet.
- For public or HTTPS reverse-proxy deployment, set `SESSION_COOKIE_SECURE=true`.
  Set `TRUST_PROXY=true` only when a trusted reverse proxy terminates HTTPS in
  front of this app.
- MySQL should remain bound to localhost; do not open its port to the VPN or
  public internet unless remote database access is explicitly required.

Verify the app from the host at `http://localhost:5500/api/health`, then from a
client at `http://26.205.99.251:5500/api/health`. A successful response is
`{"status":"ok"}`.

## Optional integrations

Set `EMAIL_USER` and `EMAIL_PASS` to enable job-match email notifications. For
Gmail, use an app password rather than your regular account password. The
`INTERNAL_JOB_TOKEN` protects the manual scraper endpoint; keep it secret and
never put it in browser code.

The GitHub Pages workflow publishes only `Server/public`. It is a static preview
and does not include the Express API, MySQL, sessions, scraper, or email jobs;
use the Node server above for a fully functional deployment.