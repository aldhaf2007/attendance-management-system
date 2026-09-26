# Coolify Deployment Guide (via GitHub)
## ARIGNAR ANNA COLLEGE Attendance Management System

This guide walks you through deploying the attendance management platform to **Coolify** directly from your GitHub repository ([`aldhaf2007/attendance-management-system`](https://github.com/aldhaf2007/attendance-management-system)).

---

## Architecture Overview in Coolify

The application utilizes a **multi-stage production container**:
- **Stage 1 (Frontend)**: Builds the React SPA (`npm run build`).
- **Stage 2 (Backend)**: Runs the FastAPI ASGI application with connection pooling, security headers, rate limiting, and database migrations.
- **Unified Serving**: FastAPI serves both the API (`/api/*`) and the React UI (`/*`) on a single port (`8000`). Coolify's built-in reverse proxy (Traefik/Caddy) provides automatic SSL (HTTPS) and routing.

---

## Deployment Option 1: Coolify Dockerfile (Recommended)

This method connects your GitHub repository to a standalone Coolify Application and links to a Coolify-managed MySQL database.

### Step 1: Create the MySQL Database in Coolify
1. In your Coolify dashboard, navigate to your **Project** and **Environment**.
2. Click **+ New Resource** -> **Database** -> **MySQL**.
3. Set the database name to `attendance_db`.
4. Note the generated **Root Password** and the internal **Host** (e.g. `mysql-randomid:3306`).
5. Click **Start** to deploy the database.

### Step 2: Create the Application from GitHub
1. In the same Environment, click **+ New Resource** -> **Application** -> **Public Repository** (or **GitHub App**).
2. Enter your repository URL:
   ```
   https://github.com/aldhaf2007/attendance-management-system
   ```
3. Branch: `main`.
4. Build Pack: Select **Dockerfile**.
5. Port: Set to `8000`.

### Step 3: Configure Environment Variables
Under the **Environment Variables** tab of your application, add the following variables:

| Variable | Value | Description |
| :--- | :--- | :--- |
| `ENVIRONMENT` | `production` | Enables strict production security assertions. |
| `PORT` | `8000` | Application listening port. |
| `SECRET_KEY` | `(32+ random characters)` | Run `openssl rand -hex 32` to generate a secure secret. |
| `DATABASE_URL` | `mysql+aiomysql://root:<DB_PASS>@<DB_HOST>:3306/attendance_db` | Connection string to your Coolify MySQL service. |
| `ALLOWED_ORIGINS` | `https://attendance.yourcollege.edu` | Your public domain(s) separated by commas. |
| `ALLOW_TIME_LOCK_BYPASS` | `False` | Enforces standard classroom hours. |
| `WEB_CONCURRENCY` | `2` | Number of worker processes. |

> [!NOTE]
> Ensure the application is connected to the same Coolify Docker network as your MySQL database so they can communicate using the database container's hostname.

### Step 4: Health Check Configuration
In your Application settings:
- **Health Check Path**: `/api/health`
- **Expected Status**: `200`
- Coolify will verify that both the web server and database connection are active before routing incoming traffic.

### Step 5: Deploy
1. Click **Deploy**.
2. Coolify will clone the repository, build the React frontend, package the Python runtime, run schema initialization (`init_db.py`), and launch the service.
3. Once the health check passes, your site is live with automated SSL!

---

## Deployment Option 2: Coolify Docker Compose

If you prefer deploying the app and MySQL together in a single unified Docker Compose stack:

1. In Coolify, click **+ New Resource** -> **Docker Compose**.
2. Select your GitHub repository: `https://github.com/aldhaf2007/attendance-management-system`.
3. Coolify will automatically detect the root [`docker-compose.yml`](file:///home/aldhaf/projects/attatence%20mg/docker-compose.yml).
4. In the Environment Variables tab, configure:
   ```env
   ENVIRONMENT=production
   DB_ROOT_PASSWORD=your_strong_mysql_password
   DB_NAME=attendance_db
   SECRET_KEY=generate_with_openssl_rand_hex_32
   ALLOWED_ORIGINS=https://attendance.yourcollege.edu
   ALLOW_TIME_LOCK_BYPASS=False
   ```
5. Set your domain name in the Coolify domain settings for the `app` service.
6. Click **Deploy**.

---

## Post-Deployment Verification

1. **Access the Application**:
   Navigate to `https://attendance.yourcollege.edu` (or your assigned Coolify subdomain).
2. **Initial Admin Login**:
   - **Username**: `admin`
   - **Password**: `admin123`
3. **Change Default Credentials**:
   Immediately log in to the **Admin System Setup & Roster Management** portal and update the administrator password.
4. **Health Probe**:
   Visit `https://attendance.yourcollege.edu/api/health` in your browser. You should receive:
   ```json
   {
     "status": "healthy",
     "database": "connected",
     "college": "ARIGNAR ANNA COLLEGE",
     "version": "1.0.0",
     "environment": "production"
   }
   ```

---

## Continuous Deployment (Auto-Deploy on Push)

1. In your Coolify Application settings, enable **Auto Deploy (Webhooks)**.
2. Coolify will provide a Webhook URL.
3. In your GitHub repository:
   - Go to **Settings** -> **Webhooks** -> **Add webhook**.
   - Paste the Coolify Webhook URL.
   - Content type: `application/json`.
   - Events: **Just the push event**.
4. Every push to `main` will now trigger an automated build and zero-downtime deployment in Coolify!
