# Docker Deployment Guide

This guide explains how to run S3 Navigator using Docker and Docker Compose.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+

## Quick Start

### Using Docker Compose (Recommended)

1. **Build and start the container:**
   ```bash
   docker-compose up -d
   ```

2. **Access the application:**
   - Open browser: http://localhost:3000
   - Login with your credentials

3. **Stop the container:**
   ```bash
   docker-compose down
   ```

4. **View logs:**
   ```bash
   docker-compose logs -f s3-browser
   ```

5. **Restart the container:**
   ```bash
   docker-compose restart
   ```

### Using Docker CLI

1. **Build the image:**
   ```bash
   docker build -t s3-navigator .
   ```

2. **Run the container:**
   ```bash
   docker run -d \
     --name s3-navigator \
     -p 3000:3000 \
     --restart unless-stopped \
     s3-navigator
   ```

3. **Stop the container:**
   ```bash
   docker stop s3-navigator
   ```

4. **Start the container:**
   ```bash
   docker start s3-navigator
   ```

5. **Remove the container:**
   ```bash
   docker rm -f s3-navigator
   ```

## Configuration

### Port Mapping

By default, the application runs on port 3000. To use a different port:

**Docker Compose:**
Edit `docker-compose.yml`:
```yaml
ports:
  - "8080:3000"  # Host:Container
```

**Docker CLI:**
```bash
docker run -d -p 8080:3000 s3-navigator
```

### Environment Variables

Available environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Node environment |
| `PORT` | `3000` | Application port |
| `HOSTNAME` | `0.0.0.0` | Bind hostname |

**Docker Compose:**
Edit `docker-compose.yml`:
```yaml
environment:
  - NODE_ENV=production
  - PORT=3000
  - CUSTOM_VAR=value
```

**Docker CLI:**
```bash
docker run -d \
  -e NODE_ENV=production \
  -e PORT=3000 \
  s3-navigator
```

## Data Persistence

**Note:** This application stores all data (users, buckets, assignments) in browser localStorage. No server-side persistence is required.

## Health Check

The container includes a built-in health check that monitors application availability.

**Check container health:**
```bash
docker-compose ps
# or
docker inspect --format='{{.State.Health.Status}}' s3-navigator
```

## Troubleshooting

### Container won't start

**Check logs:**
```bash
docker-compose logs -f
# or
docker logs -f s3-navigator
```

### Port already in use

**Find process using port 3000:**
```bash
sudo lsof -i :3000
# or
sudo netstat -tulpn | grep 3000
```

**Kill the process or use a different port.**

### Permission denied errors

**Check file permissions:**
```bash
ls -la Dockerfile docker-compose.yml
```

**Ensure Docker daemon is running:**
```bash
sudo systemctl status docker
```

### Rebuild after code changes

**Docker Compose:**
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

**Docker CLI:**
```bash
docker rm -f s3-navigator
docker build --no-cache -t s3-navigator .
docker run -d --name s3-navigator -p 3000:3000 s3-navigator
```

## Production Deployment

### Using a reverse proxy (Nginx)

**Example Nginx config:**
```nginx
server {
    listen 80;
    server_name s3.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Using SSL (Let's Encrypt)

**With Nginx:**
```bash
sudo certbot --nginx -d s3.example.com
```

**Or update docker-compose.yml to include Nginx + Certbot:**
```yaml
services:
  s3-browser:
    # ... existing config

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/letsencrypt:ro
    depends_on:
      - s3-browser
```

## Resource Limits

**Limit container resources in docker-compose.yml:**
```yaml
services:
  s3-browser:
    # ... existing config
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          memory: 256M
```

## Multi-stage Build Optimization

The Dockerfile uses a multi-stage build to minimize image size:

- **Stage 1 (deps):** Install dependencies
- **Stage 2 (builder):** Build the application
- **Stage 3 (runner):** Final production image

**Image size:** ~150-200 MB (compared to 1GB+ without optimization)

## Security Best Practices

1. **Run as non-root user:** ✅ Configured in Dockerfile
2. **Use official base images:** ✅ Using `node:18-alpine`
3. **Scan for vulnerabilities:**
   ```bash
   docker scan s3-navigator
   ```
4. **Keep base images updated:**
   ```bash
   docker pull node:18-alpine
   docker-compose build --no-cache
   ```

## Maintenance Commands

**View all containers:**
```bash
docker-compose ps -a
```

**Clean up unused images:**
```bash
docker image prune -a
```

**Clean up everything (careful!):**
```bash
docker system prune -a --volumes
```

**Export/backup container:**
```bash
docker export s3-navigator > s3-navigator-backup.tar
```

## CI/CD Integration

**Example GitHub Actions workflow:**
```yaml
name: Build Docker Image

on:
  push:
    branches: [ master ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build Docker image
        run: docker build -t s3-navigator .
      - name: Run tests
        run: docker run s3-navigator npm test
```

## Support

For issues related to:
- **Docker setup:** Check logs and troubleshooting section
- **Application bugs:** Open an issue on GitHub
- **AWS S3 permissions:** Check your bucket policies and IAM credentials

## License

Same as main application (MIT)
