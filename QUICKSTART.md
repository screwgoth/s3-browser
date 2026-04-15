# 🚀 Quick Start (5 Minutes)

Get S3 Browser running in 5 minutes!

## Prerequisites

```bash
node --version  # 18+
docker --version
```

## Setup Steps

### 1️⃣ Clone & Install
```bash
git clone https://github.com/screwgoth/s3-browser.git
cd s3-browser
git checkout database-implementation
npm install
```

### 2️⃣ Generate Keys
```bash
npm run generate-keys
```
Copy the output (you'll need it next).

### 3️⃣ Configure
```bash
cp .env.example .env
# Edit .env and paste your keys from step 2
```

### 4️⃣ Setup Database
```bash
./db.sh setup
```
Wait for: "🎉 Database setup completed!"

### 5️⃣ Start App
```bash
npm run dev
```

### 6️⃣ Login
Open http://localhost:5000

**First login:**
- Username: `admin`
- Password: `admin`

**You'll be forced to change password!**

New password must have:
- 8+ characters
- Uppercase letter
- Lowercase letter
- Number

## ✅ Done!

You're now ready to:
- Add S3 buckets
- Create users
- Browse your S3 files

## 📚 Next Steps

- **Add buckets:** Click "Add S3 Bucket"
- **Create users:** Admin → Users → Add User
- **View logs:** Admin → Audit Trail
- **Need help?** See `SETUP.md` for detailed guide

## 🔧 Useful Commands

```bash
./db.sh status     # Check database
./db.sh logs       # View logs
./db.sh backup     # Backup data
npm run dev        # Start app
```

## 🆘 Troubleshooting

**Port in use?**
```bash
sudo lsof -i :5432  # Check port
./db.sh stop        # Stop database
```

**Can't login?**
```bash
./db.sh reset  # Reset everything
./db.sh setup  # Setup again
```

**More help:** See [SETUP.md](docs/SETUP.md) or troubleshooting section

---

**Complete Guide:** See [SETUP.md](docs/SETUP.md)  
**Testing:** See [PHASE1_TESTING.md](docs/PHASE1_TESTING.md), [PHASE2_TESTING.md](docs/PHASE2_TESTING.md)
