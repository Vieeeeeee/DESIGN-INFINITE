/**
 * 邀请分享话术模板 - 统一管理
 */

export const SHARE_LINK = 'https://www.abdc.online/';

/**
 * 生成邀请分享话术
 * @param inviteCode 单个邀请码
 * @returns 完整话术文本
 */
export function generateInviteShareText(inviteCode: string): string {
    return `🎨 设计师必备！AI 版 Pinterest，设计无限生成器！
✨ 上传任意参考图片，根据空间类型，AI智能生成9张高质量空间的设计方案！

🎁 新用户注册即送1000积分，每日登录再送500积分
💰 使用我的邀请码注册，咱们双方各得500积分
🎟️ 我的邀请码：${inviteCode}

👉 立即体验：${SHARE_LINK}`;
}
