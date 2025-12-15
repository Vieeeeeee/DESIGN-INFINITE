import crypto from 'crypto';
import config from '../config.js';

/**
 * 生成 6 位数字验证码
 * @returns {string} 6 位验证码
 */
export function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * 生成邀请码
 * @returns {string} 6 位邀请码
 */
export function generateInviteCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉容易混淆的字符
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

/**
 * 获取验证码过期时间
 * @returns {string} ISO 格式的过期时间
 */
export function getCodeExpireTime() {
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + config.verificationCodeExpireMinutes);
    return expires.toISOString();
}

/**
 * 验证邮箱格式
 * @param {string} email 邮箱地址
 * @returns {boolean} 是否有效
 */
export function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * 验证密码强度
 * @param {string} password 密码
 * @returns {{ valid: boolean, message?: string }} 验证结果
 */
export function validatePassword(password) {
    if (!password || password.length < 6) {
        return { valid: false, message: '密码至少需要 6 个字符' };
    }
    if (password.length > 50) {
        return { valid: false, message: '密码不能超过 50 个字符' };
    }
    return { valid: true };
}
