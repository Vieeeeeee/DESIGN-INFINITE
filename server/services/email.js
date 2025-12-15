import nodemailer from 'nodemailer';
import config from '../config.js';

// ============================================================================
// 连接池配置 - 保持 SMTP 连接，避免每次重新握手
// ============================================================================
const transporter = nodemailer.createTransport({
  pool: true,                    // 启用连接池
  maxConnections: 3,             // 最大连接数
  maxMessages: 100,              // 每个连接最大发送数
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure,
  auth: config.smtp.auth,
  // 连接超时设置
  connectionTimeout: 10000,      // 10秒连接超时
  greetingTimeout: 10000,        // 10秒握手超时
  socketTimeout: 30000,          // 30秒发送超时
});

/**
 * 发送验证码邮件（异步版本）
 * 立即返回，后台发送邮件
 * @param {string} to 收件人邮箱
 * @param {string} code 验证码
 * @param {string} type 类型：register | reset_password
 */
export function sendVerificationEmailAsync(to, code, type) {
  // 立即返回，不等待发送完成
  setImmediate(async () => {
    try {
      await sendVerificationEmailInternal(to, code, type);
      console.log(`✅ 验证码邮件已发送至 ${to}`);
    } catch (error) {
      console.error(`❌ 邮件发送失败 (${to}):`, error.message);
    }
  });
}

/**
 * 发送验证码邮件（同步版本，等待发送完成）
 * 用于需要确认发送成功的场景
 */
export async function sendVerificationEmail(to, code, type) {
  return sendVerificationEmailInternal(to, code, type);
}

/**
 * 内部发送实现
 */
async function sendVerificationEmailInternal(to, code, type) {
  const subjects = {
    register: '【设计参考生成器】注册验证码',
    reset_password: '【设计参考生成器】重置密码验证码',
  };

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px;">
      <h1 style="color: #00d9ff; margin: 0 0 24px 0; font-size: 24px; text-align: center;">
        设计参考无限生成器
      </h1>
      <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 24px; border: 1px solid rgba(0,217,255,0.2);">
        <p style="color: #e0e0e0; font-size: 14px; margin: 0 0 16px 0;">
          您的${type === 'register' ? '注册' : '密码重置'}验证码是：
        </p>
        <div style="background: rgba(0,217,255,0.1); border-radius: 8px; padding: 16px; text-align: center; border: 1px dashed rgba(0,217,255,0.3);">
          <span style="font-size: 36px; font-weight: bold; color: #00d9ff; letter-spacing: 8px; font-family: 'Courier New', monospace;">
            ${code}
          </span>
        </div>
        <p style="color: #888; font-size: 12px; margin: 16px 0 0 0; text-align: center;">
          验证码有效期 ${config.verificationCodeExpireMinutes} 分钟，请尽快使用
        </p>
      </div>
      <p style="color: #666; font-size: 11px; margin: 20px 0 0 0; text-align: center;">
        如果您没有请求此验证码，请忽略此邮件
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: `"设计参考生成器" <${config.smtp.auth.user}>`,
    to,
    subject: subjects[type] || '验证码',
    html,
  });
}

/**
 * 测试邮件配置是否正确
 */
export async function testEmailConnection() {
  try {
    await transporter.verify();
    console.log('✅ 邮件服务连接成功 (连接池已启用)');
    return true;
  } catch (error) {
    console.error('❌ 邮件服务连接失败:', error.message);
    return false;
  }
}
