#!/bin/bash

# =====================================================
# 薪资查询系统 - Linux 一键部署脚本
# 适用于 CentOS/Ubuntu/Debian
# =====================================================

set -e  # 遇到错误立即退出

echo "🚀 ==========================================="
echo "   薪资查询系统 - 自动部署"
echo "==========================================  🚀"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否以 root 运行（可选）
if [ "$EUID" -ne 0 ] && [ "$FORCE" != "true" ]; then 
    echo -e "${YELLOW}⚠️  建议使用 sudo 或 root 用户运行此脚本${NC}"
    echo "或者设置 FORCE=true 环境变量继续..."
fi

# 安装目录
APP_DIR="/opt/salary-system"
PM2_HOME="${HOME}/.pm2"

echo ""
echo "📋 步骤 1/7: 检查环境..."

# 检查 Node.js
if ! command -v node &> /dev/null; then 
    echo -e "${RED}❌ Node.js 未安装${NC}"
    echo "请先安装 Node.js 18+ LTS"
    echo "https://nodejs.org/"
    exit 1
else
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✅ Node.js: $NODE_VERSION${NC}"
fi

# 检查 npm
if ! command -v npm &> /dev/null; then 
    echo -e "${RED}❌ npm 未安装${NC}"
    exit 1
else
    NPM_VERSION=$(npm -v)
    echo -e "${GREEN}✅ npm: $NPM_VERSION${NC}"
fi

echo ""
echo "📋 步骤 2/7: 创建应用目录..."

# 创建目录
sudo mkdir -p $APP_DIR
sudo chown $USER:$USER $APP_DIR

echo -e "${GREEN}✅ 目录已创建：$APP_DIR${NC}"

echo ""
echo "📋 步骤 3/7: 安装 PM2（进程守护）..."

# 检查 PM2
if ! command -v pm2 &> /dev/null; then 
    echo "正在全局安装 PM2..."
    sudo npm install -g pm2
fi

PM2_VERSION=$(pm2 -v)
echo -e "${GREEN}✅ PM2: v$PM2_VERSION${NC}"

echo ""
echo "📋 步骤 4/7: 配置环境变量..."

# 检查 .env 文件
if [ ! -f "$APP_DIR/.env" ]; then
    echo "创建 .env 配置文件..."
    
    # 提示用户输入数据库信息
    read -p "请输入 MySQL 主机 IP (默认：10.10.11.187): " DB_HOST
    DB_HOST=${DB_HOST:-10.10.11.187}
    
    read -p "请输入 MySQL 端口 (默认：3306): " DB_PORT
    DB_PORT=${DB_PORT:-3306}
    
    read -p "请输入 MySQL 用户名 (默认：root): " DB_USER
    DB_USER=${DB_USER:-root}
    
    echo "⚠️  注意：密码不会显示在屏幕上"
    read -sp "请输入 MySQL 密码：" DB_PASSWORD
    echo ""
    
    read -p "请输入数据库名称 (默认：a8v5): " DB_DATABASE
    DB_DATABASE=${DB_DATABASE:-a8v5}
    
    # 创建 .env 文件
    cat > $APP_DIR/.env <<EOF
# MySQL 数据库配置
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_DATABASE=$DB_DATABASE

# API 服务器配置
PORT=3000
NODE_ENV=production
EOF
    
    # 设置权限（只允许所有者读写）
    sudo chmod 600 $APP_DIR/.env
    
    echo -e "${GREEN}✅ .env 文件已创建并加密${NC}"
else
    echo -e "${YELLOW}⚠️  .env 文件已存在，跳过配置${NC}"
fi

echo ""
echo "📋 步骤 5/7: 安装依赖..."

cd $APP_DIR
npm install --production
echo -e "${GREEN}✅ 依赖安装完成${NC}"

echo ""
echo "📋 步骤 6/7: 配置 PM2 守护..."

# 检查 ecosystem.config.js
if [ ! -f "$APP_DIR/ecosystem.config.js" ]; then
    echo "创建 PM2 配置文件..."
    
    # 获取本机 IP（用于日志路径）
    HOST_IP=$(hostname -I | awk '{print $1}')
    
    cat > $APP_DIR/ecosystem.config.js <<EOF
module.exports = {
  apps: [{
    name: 'salary-query',
    script: 'server.js',
    cwd: '$APP_DIR',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/salary/error.log',
    out_file: '/var/log/salary/out.log'
  }]
}
EOF
    
    # 创建日志目录
    sudo mkdir -p /var/log/salary
    sudo chmod 755 /var/log/salary
    
    echo -e "${GREEN}✅ PM2 配置文件已创建${NC}"
fi

echo ""
echo "📋 步骤 7/7: 启动服务..."

# 停止旧实例（如果存在）
pm2 delete salary-query 2>/dev/null || true

# 启动应用
pm2 start ecosystem.config.js

# 等待启动
sleep 3

# 保存 PM2 配置
pm2 save

# 设置开机自启
echo "配置开机自启..."
pm2 startup --disable-confirmation 2>/dev/null || true

echo ""
echo -e "${GREEN}🎉 ==========================================="
echo -e "   部署完成！"
echo -e "==========================================  🎉${NC}"

# 显示服务状态
echo ""
pm2 status salary-query

# 显示访问地址
echo ""
echo -e "${GREEN}📡 访问地址：${NC}"
echo -e "   http://localhost:3000"
echo -e "   http://${HOST_IP}:3000"
echo ""

# PM2 常用命令提示
echo -e "${YELLOW}💡 PM2 常用命令：${NC}"
echo "   pm2 logs salary-query      # 查看日志"
echo "   pm2 restart salary-query   # 重启服务"
echo "   pm2 stop salary-query      # 停止服务"
echo "   pm2 monit                  # 监控资源"
echo ""

# 测试 API
echo "🧪 测试 API..."
if command -v curl &> /dev/null; then
    curl -s http://localhost:3000/api/health | head -n 5 || echo "API 测试中..."
else
    echo "请手动访问 http://localhost:3000/api/health 测试"
fi

echo ""
echo -e "${GREEN}✅ 部署成功！${NC}"
echo "如果遇到任何问题，请查看："
echo "   DEPLOY-LINUX.md           # 详细部署文档"
echo "   /var/log/salary/error.log # 错误日志"
