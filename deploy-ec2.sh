#!/bin/bash
set -e

echo "=== 1. Installing .NET 8 SDK ==="
if ! command -v dotnet &> /dev/null; then
    sudo snap install dotnet-sdk --classic --channel=8.0
    sudo ln -sf /snap/bin/dotnet /usr/bin/dotnet
fi

echo "=== 2. Building & Publishing Backend (.NET 8) ==="
cd /var/www/benkyou/Benkyou.API
dotnet publish -c Release -o /var/www/benkyou-api

echo "=== 3. Building Frontend (React 19) ==="
cd /var/www/benkyou/frontend/benkyou-ui
echo "VITE_API_URL=/api" > .env.production
npm install
npm run build
sudo mkdir -p /var/www/benkyou-html
sudo cp -r dist/* /var/www/benkyou-html/

echo "=== 4. Setting up Systemd Service for .NET API ==="
sudo bash -c 'cat > /etc/systemd/system/benkyou.service << EOF
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
EOF'

echo "=== 5. Setting up Nginx Reverse Proxy ==="
sudo bash -c 'cat > /etc/nginx/sites-available/default << EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root /var/www/benkyou-html;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection keep-alive;
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /hubs/ {
        proxy_pass http://localhost:5000/hubs/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF'

echo "=== 6. Restarting Services ==="
sudo systemctl daemon-reload
sudo systemctl enable benkyou.service
sudo systemctl restart benkyou.service
sudo systemctl restart nginx

echo "=== DEPLOYMENT COMPLETE! Benkyou is now live on Port 80 ==="
