/**
 * 创建管理员账号脚本
 */

import { initDatabase } from './database.js';
import db from './database.js';
import bcrypt from 'bcrypt';
import config from './config.js';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode() {
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
    }
    return code;
}

async function main() {
    await initDatabase();

    const email = '869116322@qq.com';
    const password = '13159861991w';

    // 检查用户是否存在
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
        console.log('❌ 用户已存在，跳过创建');
        return;
    }

    // 创建用户
    const passwordHash = await bcrypt.hash(password, 10);
    const result = db.prepare(`
    INSERT INTO users (email, password_hash, points)
    VALUES (?, ?, ?)
  `).run(email, passwordHash, 1000);

    const userId = result.lastInsertRowid;
    console.log(`\n✅ 用户创建成功！ID: ${userId}`);
    console.log(`📧 邮箱: ${email}`);
    console.log(`⭐ 初始积分: 1000`);

    // 生成邀请码
    console.log('\n🎟️  生成邀请码...\n');
    const codes = [];
    for (let i = 0; i < config.inviteCodesPerUser; i++) {
        let code;
        let attempts = 0;
        do {
            code = generateCode();
            attempts++;
        } while (
            db.prepare('SELECT id FROM invite_codes WHERE code = ?').get(code) &&
            attempts < 10
        );

        if (attempts < 10) {
            db.prepare('INSERT INTO invite_codes (code, owner_id) VALUES (?, ?)').run(code, userId);
            codes.push(code);
        }
    }

    console.log('═══════════════════════════════════');
    console.log('      你的邀请码 (' + codes.length + '个)');
    console.log('═══════════════════════════════════\n');
    codes.forEach((code, i) => {
        console.log(`  ${String(i + 1).padStart(2, '0')}. ${code}`);
    });
    console.log('\n═══════════════════════════════════');
    console.log('✅ 现在可以使用此账号登录了！');
    console.log('═══════════════════════════════════\n');
}

main().catch(console.error);
