# S3 Navigator

A modern, self-hosted S3 bucket browser built with Next.js 14. Browse, download, and upload files across multiple S3-compatible buckets with a clean UI — no CORS issues, no credentials in the browser.

## Features

### Core Features
- 🗂️ **Multi-bucket management** — Add, edit, and delete multiple S3 bucket configs
- 👤 **Multi-user support** — Role-based access control (viewer/uploader/bucket-creator/admin)
- 🔐 **Database-backed authentication** — Secure session management with forced password change
- 🔑 **Encrypted credentials** — AWS keys encrypted at rest with AES-256-GCM
- 📁 **Folder navigation** — Browse nested folders with breadcrumb navigation
- 🔍 **Search** — Filter files and folders within any directory
- ⬇️ **Downloads** — Single files, multi-select, or entire folders as ZIP
- ⬆️ **Uploads** — Upload files up to 100MB into any folder
- 📄 **Pagination** — Configurable items per page (10/25/50/100)
- ✅ **Connection testing** — Validate credentials before browsing
- 🌐 **Root folder scoping** — Optionally restrict a bucket config to a specific folder path

### Security & Compliance
- 🔒 **Encrypted storage** — AWS credentials encrypted with AES-256-GCM
- 🔐 **Session management** — HTTP-only secure cookies, 24-hour expiration
- 🔑 **Password policy** — Strong password requirements enforced
- 📝 **Audit trail** — PCI-DSS compliant logging of all operations
- 👥 **Role-based access** — Granular permissions per user role
- 🚫 **Server-side only** — All AWS API calls run server-side; no credentials in browser

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Database:** PostgreSQL 16 with encrypted storage
- **Authentication:** bcrypt password hashing, session-based auth
- **Encryption:** AES-256-GCM for AWS credentials
- **Styling:** Tailwind CSS + shadcn/ui
- **AWS SDK:** `@aws-sdk/client-s3` (server-side only)
- **Management:** pgAdmin 4 for database administration

## Getting Started

> **⚡ Quick Start:** See [QUICKSTART.md](QUICKSTART.md) for 5-minute setup  
> **📚 Complete Guide:** See [SETUP.md](docs/SETUP.md) for detailed instructions

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- npm or yarn

### Quick Setup (Database-backed)

```bash
# 1. Clone and install
git clone https://github.com/screwgoth/s3-browser.git
cd s3-browser
git checkout database-implementation
npm install

# 2. Generate encryption keys
npm run generate-keys

# 3. Configure environment
cp .env.example .env
# Edit .env with your generated keys

# 4. Setup database
./db.sh setup

# 5. Start application
npm run dev
```

Open [http://localhost:5000](http://localhost:5000)

**Default login:** `admin` / `admin` (you'll be forced to change password)

### Legacy Setup (localStorage)

**Prerequisites:**
- Node.js 18+
- npm or yarn

**Installation:**

```bash
git clone https://github.com/screwgoth/s3-browser.git
cd s3-browser
npm install
```

**Running Locally:**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Production Build:**

```bash
npm run build
npm start
```

## Usage

### Default Login

| Username | Password | Role  |
|----------|----------|-------|
| `admin`  | `admin`  | Admin |

> ⚠️ Change the default credentials before exposing this app publicly.

### Adding a Bucket

1. Click **Add S3 Bucket**
2. Fill in:
   - **Alias** — a friendly name for the bucket
   - **S3 Bucket Name** — the actual bucket name
   - **AWS Region** — e.g. `us-east-1`, `ap-south-1`
   - **Root Folder** *(optional)* — restrict access to a subfolder
   - **AWS Access Key ID** *(optional)* — leave empty for public buckets or IAM role environments
   - **AWS Secret Access Key** *(optional)*
   - **AWS Session Token** *(optional)* — required for temporary credentials (STS, IAM roles, AWS SSO)
3. Click **Test** to validate the connection
4. Click **Browse** once connected

### AWS Session Token

Session tokens are required when using temporary credentials from:
- AWS STS (`AssumeRole`, `GetSessionToken`)
- AWS IAM Identity Center (SSO)
- EC2/ECS instance profiles via STS

All three fields (Access Key, Secret Key, Session Token) must be filled in together for temporary credentials to work.

## Architecture

All S3 operations run exclusively as **Next.js Server Actions** — no AWS SDK code runs in the browser. This eliminates:
- CORS issues (no browser→S3 requests)
- Credential exposure (keys never sent to client)

| Operation            | Implementation          |
|----------------------|-------------------------|
| List folder contents | Server action           |
| Download file        | Server action (base64)  |
| Download folder/ZIP  | Server action (base64)  |
| Bulk download        | Server action (base64)  |
| Upload file          | Server action           |
| Validate connection  | Server action           |

Bucket configurations (names, credentials) are stored in **browser localStorage** per user account. No backend database is required.

## Limitations

- **File upload limit:** 100MB per file
- **Large file downloads:** Files are buffered in server memory before streaming to the client. Very large files (>500MB) may be slow or time out.
- **No persistence:** Bucket configs are stored in localStorage — clearing browser data removes them.
- **Authentication:** Basic username/password stored in memory (not production-grade auth).

## License

MIT
