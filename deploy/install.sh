#!/usr/bin/env bash
# Ant2api Linux One-Click Deployment Script
set -e

echo "=========================================================="
echo "          🚀 Ant2api Linux 一键安装与部署脚本             "
echo "=========================================================="

APP_DIR="/opt/ant2api"
SERVICE_NAME="ant2api"
PORT="8080"
ADMIN_PASS="ant2api_admin"

# Check root privileges
if [ "$EUID" -ne 0 ]; then
  echo "❌ 请使用 root 或 sudo 运行此脚本: sudo bash deploy/install.sh"
  exit 1
fi

echo "📦 正在检测系统依赖..."
if [ -f /etc/debian_version ]; then
  # Debian / Ubuntu
  apt-get update -y
  apt-get install -y curl git build-essential
elif [ -f /etc/redhat-release ]; then
  # CentOS / RHEL / Rocky Linux
  yum install -y curl git gcc-c++ make
fi

# Check Node.js >= 18
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 18 ]; then
  echo "📥 正在安装 Node.js 20 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs || yum install -y nodejs
fi

echo "✅ Node.js 版本: $(node -v)"
echo "✅ NPM 版本: $(npm -v)"

# Prepare directory
echo "📂 正在同步项目文件至 ${APP_DIR}..."
mkdir -p "${APP_DIR}"
cp -r ./* "${APP_DIR}/" 2>/dev/null || true

cd "${APP_DIR}"

# Install dependencies and build
echo "⚙️ 正在安装依赖并编译 TypeScript..."
npm install
npm run build

# Create systemd service
echo "🔧 正在配置 Systemd 服务 (${SERVICE_NAME}.service)..."
cat <<EOF > /etc/systemd/system/${SERVICE_NAME}.service
[Unit]
Description=Ant2api Universal AI Gateway Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${APP_DIR}
Environment=NODE_ENV=production
Environment=PORT=${PORT}
Environment=ADMIN_PASSWORD=${ADMIN_PASS}
Environment=DATA_DIR=${APP_DIR}/data
ExecStart=$(which node) ${APP_DIR}/dist/index.js
Restart=always
RestartSec=5
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=ant2api

[Install]
WantedBy=multi-user.target
EOF

# Reload & Start Service
systemctl daemon-reload
systemctl enable ${SERVICE_NAME}
systemctl restart ${SERVICE_NAME}

# Check Service Status
sleep 2
if systemctl is-active --quiet ${SERVICE_NAME}; then
  echo "=========================================================="
  echo "  🎉 Ant2api 安装并启动成功！"
  echo "  --------------------------------------------------------"
  echo "  🌐 Web 管理面板: http://<你的服务器IP>:${PORT}"
  echo "  🔑 初始管理密码: ${ADMIN_PASS}"
  echo "  📡 OpenAI 兼容端点: http://<你的服务器IP>:${PORT}/v1/chat/completions"
  echo "  📡 Claude 兼容端点: http://<你的服务器IP>:${PORT}/v1/messages"
  echo "  📡 Gemini 兼容端点: http://<你的服务器IP>:${PORT}/v1beta/models"
  echo "  "
  echo "  🛠 管理命令:"
  echo "     - 查看状态: sudo systemctl status ${SERVICE_NAME}"
  echo "     - 查看日志: sudo journalctl -u ${SERVICE_NAME} -f"
  echo "     - 重启服务: sudo systemctl restart ${SERVICE_NAME}"
  echo "=========================================================="
else
  echo "❌ 服务启动失败，请运行 sudo journalctl -u ${SERVICE_NAME} -n 50 查看错误日志。"
  exit 1
fi
