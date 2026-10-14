# Cloud Deployment Guide: Benkyou Web ERP & LMS

This document describes the cloud architecture and step-by-step process for deploying the **Benkyou Web ERP & LMS** platform to **Amazon Web Services (AWS)**.

---

## Architecture Overview

* **Frontend:** React 19 + Vite Single Page Application (SPA), bundled and served via NGINX.
* **Backend:** ASP.NET Core 8 Web API (`Benkyou.API`, `Benkyou.Core`, `Benkyou.Data`).
* **Database:** Managed AWS RDS for PostgreSQL (`db.t4g.micro`, AWS Free Tier, Sydney `ap-southeast-2`).
* **Process Manager:** Linux `systemd` daemon (`benkyou.service`) ensuring the .NET Kestrel backend runs continuously in the background on port `5000` with auto-restart on system boot.
* **Reverse Proxy:** NGINX on port `80`/`443` (routes static SPA frontend assets, proxies REST API traffic to `/api/`, and handles WebSocket upgrades for SignalR real-time hubs on `/hubs/`).
* **File Storage:** Amazon S3 (Cloud Object Storage for curriculum documents, downloadable syllabus files, and automated database backups).
* **IAM Security:** EC2 Instance Role with AWS S3 Access Policy (enables secure, keyless cloud storage access without hardcoded credentials).
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
        │                                 │   │            │
        │                                 │   └───► [ IAM Role ]
        └─────────────────────────────────┼─────────────┬──┘
                                          │             │
                         Encrypted SQL Connection       │ S3 Put/Get Object
                                          │             │ (Port 443)
                                          ▼             ▼
                         ┌─────────────────┐   ┌─────────────────┐
                         │  AWS RDS PG DB  │   │    Amazon S3    │
                         │   (benkyoudb)   │   │  (File Storage) │
                         └─────────────────┘   └─────────────────┘
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

    # Swagger / OpenAPI Documentation Proxy
    location /swagger {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection keep-alive;
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

# 8. Configuring Amazon S3 for File Uploads & Backups

### Step 1: Create S3 Bucket
1. In the **AWS Management Console**, navigate to **Amazon S3** -> click **Create bucket**.
2. **Bucket name:** `benkyou-storage-charlize` *(globally unique lowercase name)*.
3. **AWS Region:** Select `ap-southeast-2` (Asia Pacific - Sydney, matching EC2 and RDS).
4. Configure CORS or bucket permissions as needed for application access.
5. Click **Create bucket**.

---

### Step 2: Create IAM Role for EC2
To follow AWS security best practices, the EC2 instance accesses S3 securely without hardcoding secret keys:

1. Go to **AWS IAM** -> **Roles** -> click **Create role**.
2. Select **AWS service** as the trusted entity.
3. Select **EC2** as the common use case -> click **Next**.
4. Attach the custom S3 Policy (or `AmazonS3FullAccess`):

#### Example S3 Policy (Least Privilege)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::benkyou-storage-charlize/*"
    }
  ]
}
```
5. Name the role **`EC2-S3-Access-Role`** and click **Create role**.

---

### Step 3: Attach IAM Role to EC2 Instance
1. In **Amazon EC2**, go to **Instances** -> select `benkyou-server`.
2. Click **Actions** -> **Security** -> **Modify IAM role**.
3. Choose **`EC2-S3-Access-Role`** from the dropdown.
4. Click **Update IAM role**.

---

### Step 4: Interacting with S3 from EC2 (AWS CLI & Backend SDK)

#### 1. Via AWS CLI (Automated Backups & File Sync):
```bash
# Install AWS CLI on the EC2 server
sudo apt install -y awscli

# Verify keyless access provided by EC2 IAM Role
aws s3 ls

# Upload file directly to S3
aws s3 cp /var/www/benkyou/test.txt s3://benkyou-storage-charlize/
```

#### 2. Via Backend AWS SDK (`AWSSDK.S3`):
Install the official AWS SDK package:
```bash
dotnet add package AWSSDK.S3
```

Configure keyless S3 client (the AWS SDK automatically retrieves temporary credentials from the attached EC2 IAM Role):
```csharp
using Amazon;
using Amazon.S3;

// No hardcoded credentials needed - EC2 IAM Role provides them automatically
var s3Client = new AmazonS3Client(RegionEndpoint.APSoutheast2);
```

---

# 9. Maintenance & Useful Commands

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

---

# 10. Policy and Access Matrix

The following matrix identifies IAM entities, their attached policies and permissions, along with security justifications for granting those permissions based on the Principle of Least Privilege:

| IAM Entity | Policy Attached | Justification |
| :--- | :--- | :--- |
| **EC2 Backend Role**<br>*(e.g., `EC2-S3-Access-Role`)* | Custom S3 Access Policy (`s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:ListBucket` strictly limited to `arn:aws:s3:::benkyou-storage-charlize/*` and `arn:aws:s3:::benkyou-storage-charlize`) | Allows the backend ASP.NET Core 8 application running on EC2 to securely upload, retrieve, delete, and list curriculum assets and database backups in the designated S3 bucket without hardcoding AWS access keys or secrets in the codebase. Adheres to the Principle of Least Privilege by restricting access strictly to one bucket only. |
| **DevOps / Administrator User**<br>*(e.g., `AdminUser`)* | `AmazonEC2FullAccess`, `AmazonRDSFullAccess`, `AmazonS3FullAccess`, `IAMFullAccess` | Required to provision, configure, and maintain infrastructure components including EC2 virtual instances, RDS PostgreSQL database instances, S3 storage buckets, and IAM roles/policies. These permissions are strictly granted for deployment, maintenance, environment updates, and infrastructure monitoring. |
| **Auditor User**<br>*(Optional)* | `SecurityAudit`, `ReadOnlyAccess` | Allows security compliance teams and external auditors to monitor, inspect, and audit AWS resource configurations, CloudTrail events, and network policies without the ability to modify, launch, or delete infrastructure. Ensures security oversight while preventing accidental or unauthorized system disruptions. |
| **Database Application Access**<br>*(RDS Security Scoping)* | Security Group Inbound Rule restricting Port 5432 to the EC2 Private/Public IP, with role-based database permissions (`benkyou_admin`) | Restricts PostgreSQL database connection access exclusively to the authorized application backend server. Enforces encrypted transit (`SSL Mode=Require`) and prevents public exposure of raw database administrative interfaces. |

---

# 11. Threat Model (STRIDE Model)

Using the **STRIDE** methodology, the following matrix identifies potential security threats across the application and AWS cloud deployment architecture, evaluates their vulnerability status, and specifies implemented mitigations to prevent unauthorized access or data exposure:

| Threat | Vulnerability Status | Justification & Implemented Mitigations |
| :--- | :--- | :--- |
| **Spoofing** | Partially Vulnerable | **Risk:** Attackers could attempt credential stuffing, brute-forcing administrator accounts, or forging JWT bearer tokens to impersonate students, instructors, or SuperAdmins.<br><br>**Mitigations:**<br>1. **Multi-Factor Authentication (2FA OTP):** Mandatory 6-digit email verification code via Resend API required for SuperAdmin logins.<br>2. **Cryptographic JWT Tokens:** Short-lived HMAC-SHA256 signed access tokens (120-minute expiry) with 5-minute temporary tokens restricted to the OTP step.<br>3. **Account Lockout Shield:** Automatically locks accounts for 15 minutes after 5 consecutive failed login attempts.<br>4. **IAM Instance Profile:** Keyless EC2 IAM Role eliminates long-lived AWS secret access keys, preventing infrastructure identity spoofing. |
| **Tampering** | Partially Vulnerable | **Risk:** Data in transit could be intercepted and manipulated (Man-in-the-Middle) if HTTP is unencrypted; database records or curriculum media could be altered if endpoints or storage are misconfigured.<br><br>**Mitigations:**<br>1. **End-to-End TLS/HTTPS:** Enforced via NGINX with Let's Encrypt SSL/TLS certificates (Certbot), encrypting all client-server communications.<br>2. **SQL Injection Defense:** Entity Framework Core parameterized LINQ queries prevent any raw SQL execution or query tampering.<br>3. **Database Encrypted In-Transit:** PostgreSQL connections enforce `SSL Mode=Require; Trust Server Certificate=true`.<br>4. **S3 Object Integrity:** S3 bucket permissions restrict write access exclusively to the EC2 backend role. |
| **Repudiation** | Partially Vulnerable | **Risk:** Users or malicious actors could deny performing critical actions such as altering academic grades, editing institutional settings, or deleting course materials.<br><br>**Mitigations:**<br>1. **Application-Level Audit Trail:** Built-in `AuditLogs` table automatically logs non-repudiable records including `TenantID`, `UserID`, `Action`, `EntityType`, `EntityID`, `OldValues`, `NewValues`, client IP address, and UTC timestamp.<br>2. **Server & Web Logs:** NGINX access/error logs (`/var/log/nginx/`) and systemd journal logs (`journalctl -u benkyou.service`) maintain detailed server request records.<br>3. **Cloud Auditing:** AWS CloudTrail can monitor all administrative IAM, EC2, and S3 actions. |
| **Information Disclosure** | Partially Vulnerable | **Risk:** Cross-tenant data leakage between academic institutions sharing the multi-tenant database, exposed secrets in repositories, or publicly exposed S3 buckets.<br><br>**Mitigations:**<br>1. **Multi-Tenant Cryptographic Isolation:** Strict multi-tenant data isolation (`TenantID`) enforced at the query level using EF Core expression trees and JWT token claims.<br>2. **Private S3 Bucket:** "Block All Public Access" enabled on the S3 bucket; assets are served through application validation.<br>3. **Scrubbed Source Code:** All API keys, database connection strings, and JWT secrets scrubbed from Git and stored strictly in server-side configuration (`appsettings.Production.json`).<br>4. **Database Firewall:** AWS RDS security group restricts port 5432 access. |
| **Denial of Service (DoS)** | Moderately Vulnerable | **Risk:** A single `t2.micro` or `t3.micro` EC2 instance can be overwhelmed by high volumetric traffic, DDoS floods, or repetitive unauthenticated requests, exhausting CPU and memory.<br><br>**Mitigations:**<br>1. **Fixed-Window Rate Limiting:** Built-in ASP.NET Core rate limiting (`Microsoft.AspNetCore.RateLimiting`) strictly throttles requests to `/api/auth/login` and `/api/auth/register-org`.<br>2. **Reverse Proxy Buffering:** NGINX handles static asset caching and buffers slow client connections away from Kestrel.<br>3. **Process Supervision:** Systemd service configured with `Restart=always` and `RestartSec=10` to automatically recover from memory exhaustion.<br>4. **Recommended Scale-Out:** Future implementation of an AWS Application Load Balancer (ALB) with an Auto Scaling Group and AWS WAF. |
| **Elevation of Privilege** | Low Vulnerability | **Risk:** A student or standard tenant operator manipulating request parameters to elevate their role to Tenant Admin or SuperAdmin, or compromising the EC2 host root account.<br><br>**Mitigations:**<br>1. **Role-Based Access Control (RBAC):** Strict controller-level authorization attributes (`[Authorize(Roles = "SuperAdmin")]`, `[Authorize(Roles = "Admin")]`) validated directly against cryptographically verified JWT claims.<br>2. **Unprivileged Server Execution:** Kestrel backend runs under the unprivileged `ubuntu` user rather than `root`.<br>3. **Principle of Least Privilege:** EC2 IAM role is restricted solely to specific S3 object operations, preventing the server from modifying AWS account permissions. |
