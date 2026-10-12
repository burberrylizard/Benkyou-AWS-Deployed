# Cloud Deployment Guide: Benkyou Web ERP & LMS

This document describes the cloud architecture and step-by-step process for deploying the **Benkyou Web ERP & LMS** platform to **Amazon Web Services (AWS)**.

---

## Architecture Overview

* **Frontend:** React 19 + Vite Single Page Application (SPA), bundled and served via NGINX.
* **Backend:** ASP.NET Core 8 Web API (`Benkyou.API`, `Benkyou.Core`, `Benkyou.Data`).
* **Database:** Managed AWS RDS for PostgreSQL (`db.t4g.micro`, AWS Free Tier, Sydney `ap-southeast-2`).
* **Process Manager:** Linux `systemd` daemon (`benkyou.service`) ensuring the .NET Kestrel backend runs continuously in the background on port `5000` with auto-restart on system boot.
* **Reverse Proxy:** NGINX on port `80`/`443` (routes static SPA frontend assets, proxies REST API traffic to `/api/`, and handles WebSocket upgrades for SignalR real-time hubs on `/hubs/`).
* **Security & SSL:** Let's Encrypt SSL certificate via Certbot (HTTPS encryption) with DNS routing.
* **Third-Party Services:** Resend API (Transactional 2FA OTP emails), Stripe API (Tenant subscriptions), Cloudinary (CDN media storage).
* **Network & Firewall:** AWS EC2 Security Group (Ports `22`, `80`, `443`) and AWS RDS Security Group (Port `5432`).

---

## System Architecture

```text
                        [ Client Browser ]
                                │
                                ▼
                       HTTPS (Port 443) / HTTP (Port 80)
                                │
                                ▼
        ┌──────────────────────────────────────────────────┐
        │             AWS EC2 (Ubuntu Linux)               │
        │                                                  │
        │                 [ NGINX ]                        │
        │                /         \                       │
        │               /           \                      │
        │   location / /             \ location /api/      │
        │             ▼               ▼ location /hubs/    │
        │     [ React 19 SPA ]     [ ASP.NET Core 8 API ]  │
        │     (/var/www/html)      (Kestrel :5000)         │
        │                                 │                │
        └─────────────────────────────────┼────────────────┘
                                          │
                         Encrypted SQL Connection (Port 5432)
                                          │
                                          ▼
                         ┌─────────────────────────────────┐
                         │    AWS RDS PostgreSQL Engine    │
                         │          (benkyoudb)            │
                         └─────────────────────────────────┘
                                          │
                        ┌─────────────────┴─────────────────┐
                        ▼                                   ▼
               [ Resend Email API ]                [ Stripe & Cloudinary ]
                  (2FA OTP Codes)                     (Billing & Media)
```

---

# 1. Database Provisioning (AWS RDS PostgreSQL)

### Step 1: Create PostgreSQL Database Instance
1. In the **AWS Management Console**, navigate to **Amazon RDS** -> **Databases** -> **Create database**.
2. Select **Standard create** and choose **PostgreSQL**.
3. Choose the **Free tier** template.
4. Set the configuration:
   * **DB instance identifier:** `benkyou-db`
   * **Master username:** `benkyou_admin`
   * **Master password:** Set a secure password
   * **DB instance class:** `db.t4g.micro` (Free Tier eligible)
   * **Allocated storage:** `20 GB` General Purpose SSD
5. Under **Connectivity**:
   * **Public access:** `Yes` (to enable database migrations)
   * **VPC security group:** Choose **Create new** (`benkyou-rds-sg`)
   * **Port:** `5432`
6. Under **Additional configuration**:
   * **Initial database name:** `benkyoudb`
7. Click **Create database** and wait until Status is **Available**.

### Step 2: Configure RDS Security Group
1. In RDS, select `benkyou-db` -> **Connectivity & security** -> click the security group (`benkyou-rds-sg`).
2. Edit **Inbound rules** and add:
   * **Type:** `PostgreSQL` | **Port:** `5432` | **Source:** `0.0.0.0/0` (or EC2 Security Group ID)
3. Save rules.

---

# 2. Deploying Backend & Frontend to AWS EC2

### Step 1: Launch an Ubuntu Server Instance
1. Navigate to **Amazon EC2** -> **Launch instance**.
2. Configure instance details:
   * **Name:** `benkyou-server`
   * **OS (AMI):** Ubuntu Server 24.04 LTS (Free Tier eligible)
   * **Instance Type:** `t2.micro` or `t3.micro`
   * **Key pair:** Proceed without a key pair (or attach your SSH key)
3. Under **Network settings**, enable:
   * [x] **Allow SSH traffic** (Port 22) from `0.0.0.0/0`
   * [x] **Allow HTTP traffic from the internet** (Port 80)
   * [x] **Allow HTTPS traffic from the internet** (Port 443)
4. Click **Launch instance**.

### Step 2: Connect to the Server
1. From the EC2 Console, select `benkyou-server` and click **Connect**.
2. Choose **EC2 Instance Connect** and click **Connect** to open the browser terminal.

---

# 3. Server Configuration & Software Installation

### Step 1: Install Dependencies (.NET 8, Node.js, NGINX, Git)
Run the following commands in the EC2 terminal:

```bash
# Update package repositories
sudo apt update -y && sudo apt upgrade -y

# Install NGINX, Git, Curl, and PostgreSQL client
sudo apt install -y nginx git curl postgresql-client

# Install .NET 8 SDK
sudo snap install dotnet-sdk --classic --channel=8.0
sudo ln -sf /snap/bin/dotnet /usr/bin/dotnet

# Install Node.js 20 LTS for building the frontend
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Verify installations:
```bash
dotnet --version   # Should output 8.0.x
node -v            # Should output v20.x
nginx -v           # Should output nginx/1.28.x
```

---

# 4. Building & Running the Backend API

### Step 1: Clone the Application Repository
```bash
sudo mkdir -p /var/www
sudo chown -R ubuntu:ubuntu /var/www
cd /var/www
git clone https://github.com/burberrylizard/Benkyou-AWS-Deployed.git benkyou
```

### Step 2: Configure Production Environment Variables
Edit the production configuration file:
```bash
sudo nano /var/www/benkyou/Benkyou.API/appsettings.Production.json
```
Ensure your RDS connection string and third-party API keys are set:
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=benkyou-db.cl86w848e85u.ap-southeast-2.rds.amazonaws.com;Port=5432;Database=benkyoudb;Username=benkyou_admin;Password=YourPassword;SSL Mode=Require;Trust Server Certificate=true;"
  },
  "Jwt": {
    "Key": "THIS_IS_A_SUPER_SECRET_KEY_12345_FOR_PROD",
    "Issuer": "BenkyouAPI",
    "Audience": "BenkyouClient",
    "ExpiryMinutes": 120
  },
  "Resend": {
    "ApiToken": "YOUR_RESEND_API_KEY",
    "SenderEmail": "onboarding@resend.dev",
    "SenderName": "Benkyou Support"
  }
}
```

### Step 3: Build & Publish ASP.NET Core 8 API
```bash
cd /var/www/benkyou/Benkyou.API
dotnet publish -c Release -o /var/www/benkyou-api
```

### Step 4: Configure `systemd` Process Manager
Create a background service file to keep Kestrel running 24/7:
```bash
sudo tee /etc/systemd/system/benkyou.service > /dev/null << 'EOF'
[Unit]
Description=Benkyou .NET Web API
After=network.target

[Service]
WorkingDirectory=/var/www/benkyou-api
ExecStart=/usr/bin/dotnet /var/www/benkyou-api/Benkyou.API.dll
Restart=always
RestartSec=10
KillSignal=SIGINT
SyslogIdentifier=benkyou-api
User=ubuntu
Environment=ASPNETCORE_ENVIRONMENT=Production
Environment=ASPNETCORE_URLS=http://localhost:5000

[Install]
WantedBy=multi-user.target
EOF
```

Start and enable the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable benkyou.service
sudo systemctl start benkyou.service
sudo systemctl status benkyou.service
```

---

# 5. Building & Deploying the React 19 Frontend

### Step 1: Build the Frontend Assets
```bash
cd /var/www/benkyou/frontend/benkyou-ui
echo "VITE_API_URL=/api" > .env.production
npm install
npm run build
```

### Step 2: Deploy Static Build Files
```bash
sudo mkdir -p /var/www/benkyou-html
sudo cp -r dist/* /var/www/benkyou-html/
```

---

# 6. Configuring NGINX as Reverse Proxy

Configure NGINX to serve the React SPA and forward API and SignalR WebSocket requests to Kestrel.

### Step 1: Create NGINX Server Block
```bash
sudo tee /etc/nginx/sites-available/default > /dev/null << 'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root /var/www/benkyou-html;
    index index.html;

    # React SPA Routing (supports browser history routing)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # REST API Reverse Proxy
    location /api/ {
        proxy_pass http://localhost:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection keep-alive;
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SignalR Real-Time WebSocket Proxy
    location /hubs/ {
        proxy_pass http://localhost:5000/hubs/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
```

### Step 2: Test and Restart NGINX
```bash
sudo nginx -t
sudo systemctl restart nginx
```

---

# 7. Configuring Free SSL / HTTPS (Let's Encrypt & Certbot)

### Step 1: Point Domain / Subdomain to EC2 Public IP
1. Create a free subdomain via [DuckDNS](https://www.duckdns.org) or your custom domain provider (e.g., `benkyou-app.duckdns.org`).
2. Point the `A` record to your EC2 Public IP (`3.27.67.143`).

### Step 2: Install Certbot and Issue Certificate
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d YOUR_DOMAIN.duckdns.org
```
* Follow the on-screen prompts to enter your email and accept terms.
* Certbot automatically updates your NGINX configuration with SSL/TLS parameters and configures automatic renewal.

---

# 8. Maintenance & Useful Commands

* **Check Backend Status:**
  ```bash
  sudo systemctl status benkyou.service
  ```
* **View Real-Time Backend Logs:**
  ```bash
  sudo journalctl -u benkyou.service -f
  ```
* **Restart Backend:**
  ```bash
  sudo systemctl restart benkyou.service
  ```
* **Restart NGINX:**
  ```bash
  sudo systemctl restart nginx
  ```
* **Test Database Connectivity:**
  ```bash
  PGPASSWORD='YourPassword' psql -h benkyou-db.cl86w848e85u.ap-southeast-2.rds.amazonaws.com -U benkyou_admin -d benkyoudb
  ```
