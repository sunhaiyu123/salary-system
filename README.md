# 📊 薪资查询系统

完整的薪资查询解决方案，包含前端页面和 Node.js 后端 API。

## 🚀 快速启动

### 1️⃣ 安装依赖

```bash
cd salary-system
npm install
```

### 2️⃣ 启动后端 API

```bash
npm start
```

等待看到：
```
🚀 薪资查询 API 服务已启动
📡 监听端口：3000
🔗 API 地址：http://localhost:3000/api/salary
```

### 3️⃣ 打开前端页面

直接双击 `index.html` 或在浏览器中打开：
```
file:///C:/Users/sunhaiyu/.openclaw/workspace/salary-system/index.html
```

或者使用本地服务器：
```bash
npx serve .
```

## 📋 功能特点

- ✅ **真实数据库连接** - MySQL 直连查询
- ✅ **自动系数计算** - 根据工会会费动态计算每人系数
- ✅ **精确到月份** - 可查询任意月份的薪资
- ✅ **数据分类展示** - 工资、福利、社保清晰分组
- ✅ **实时汇总统计** - 税前、扣除、实发一目了然
- ✅ **响应式设计** - 手机电脑都能用

## 🛠️ 技术栈

- **前端**: HTML5 + CSS3 + JavaScript (原生)
- **后端**: Node.js + Express
- **数据库**: MySQL
- **依赖包**: mysql2, cors, dotenv

## 🔧 配置说明

配置文件：`.env`

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=gxsfasdf
DB_DATABASE=a8v5
PORT=3000
```

## 📝 API 接口

### 查询薪资
```
GET /api/salary?name=sunhaiyu&year=2024&month=03
```

### 健康检查
```
GET /api/health
```

## ⚠️ 注意事项

1. 确保 MySQL 服务正在运行
2. 确保数据库连接信息正确
3. 防火墙需允许 3000 端口（如果远程访问）
4. 工会会费 property_id: `-1853916752288068131`

## 🐛 故障排查

### 问题：API 连接失败
**解决**: 
- 检查 Node.js API 是否启动 (npm start)
- 检查端口 3000 是否被占用
- 检查 .env 文件配置是否正确

### 问题：数据库连接失败  
**解决**:
- 检查 MySQL 服务是否运行
- 验证用户名密码是否正确
- 确认数据库 a8v5 存在

### 问题：查不到数据
**解决**:
- 确认姓名输入正确
- 确认年月格式正确 (YYYY-MM)
- 检查该人员是否有工会会费记录（用于计算系数）

## 📞 作者

鱼钳壹号 🦞 - OpenClaw AI 助手
