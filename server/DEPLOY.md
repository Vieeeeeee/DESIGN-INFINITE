# 用户管理系统部署文档

本文档说明如何在腾讯云服务器上部署用户管理系统。

## 一、服务器要求

- Node.js 18+ (推荐使用 nvm 安装)
- Nginx (用于反向代理)
- PM2 (用于进程管理)

## 二、后端部署

### 1. 上传代码到服务器

```bash
# 在服务器上
mkdir -p /www/wwwroot/design-ref
cd /www/wwwroot/design-ref
# 上传 server 目录到此处
```

### 2. 安装依赖

```bash
cd server
npm install --production
```

### 3. 配置环境变量

复制 `.env.example` 为 `.env` 并修改：

```bash
cp .env.example .env
nano .env
```

**必须修改的配置：**

```env
# 生成随机密钥 (可用: openssl rand -hex 32)
JWT_SECRET=你的随机密钥

# 邮箱配置
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_USER=你的邮箱@qq.com
SMTP_PASS=你的SMTP授权码

# 前端地址 (改为你的域名)
FRONTEND_URL=https://你的域名.com
```

### 4. 使用 PM2 启动

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start index.js --name "design-ref-api"

# 设置开机自启
pm2 save
pm2 startup
```

## 三、前端部署

### 1. 本地构建

```bash
# 在项目根目录
npm run build
```

### 2. 上传 dist 目录到服务器

```bash
# 上传 dist 目录到 /www/wwwroot/design-ref/dist
```

## 四、Nginx 配置

在宝塔面板或直接编辑 Nginx 配置文件：

```nginx
server {
    listen 443 ssl http2;
    server_name 你的域名.com;
    
    # SSL 证书配置...
    
    root /www/wwwroot/design-ref/dist;
    index index.html;
    
    # 前端路由
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # API 代理
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 五、邮箱配置指南

### QQ 邮箱

1. 登录 [QQ 邮箱](https://mail.qq.com)
2. 进入 **设置** → **账户**
3. 找到 **POP3/IMAP/SMTP/Exchange/CardDAV/CalDAV 服务**
4. 开启 **IMAP/SMTP 服务**
5. 点击"生成授权码"，按提示用手机发送短信验证
6. 复制生成的 16 位授权码到 `.env` 的 `SMTP_PASS`

### 腾讯企业邮箱

```env
SMTP_HOST=smtp.exmail.qq.com
SMTP_PORT=465
SMTP_USER=noreply@你的域名.com
SMTP_PASS=邮箱密码
```

## 六、首次使用

1. 访问你的网站
2. 系统检测到无用户，显示"系统初始化"页面
3. 输入管理员邮箱和密码
4. 创建成功后，系统自动生成 10 个邀请码
5. 使用邀请码邀请其他用户注册

## 七、常见问题

### 验证码邮件发送失败

1. 检查 SMTP 配置是否正确
2. QQ 邮箱请确保使用的是授权码而非密码
3. 检查服务器防火墙是否开放 465 端口

### 数据库位置

SQLite 数据库文件位于 `server/data.db`，建议定期备份。

---

部署完成后，用户管理系统即可正常使用！
