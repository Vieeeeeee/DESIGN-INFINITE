/**
 * 邀请分享话术模板 - 统一管理
 */

export const SHARE_LINK = 'https://www.abdc.online/';

/**
 * 生成邀请分享话术
 * @param inviteCode 单个邀请码
 * @returns 完整话术文本
 */
export const generateInviteShareText = (inviteCode: string) => {
    return `🎨 设计师必备的灵感加速器：AI 版 Pinterest「设计无限生成器」上线！

✨ 不用写提示词：上传任意参考图，选择你要的空间类型，AI 一键生成 9 张高质量空间方案，直接给你可用的设计方向与氛围参考。

🍌 底层调用：全球领先的 nanobanana pro 原生模型，出图更稳、更细、更“像真设计”。

🎁 新用户注册即送 1000 积分，每天登录再送 500 积分
💰 用我的邀请码注册，我们双方各得 500 积分
🎟️ 邀请码：${inviteCode}

👉 立即免费体验：https://www.abdc.online/`;
};
