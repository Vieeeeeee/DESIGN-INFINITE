/**
 * 初始邀请码生成脚本
 * 用于在没有用户的情况下生成系统邀请码
 * 
 * 运行方式: node generate-initial-codes.js
 */

import { initDatabase } from './database.js';
import db from './database.js';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode() {
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
    }
    return code;
}

async function main() {
    // 初始化数据库
    await initDatabase();

    console.log('\n🎟️  正在生成初始邀请码...\n');

    // 先创建一个系统用户（owner_id = 0 表示系统）
    // 由于外键约束，我们需要先创建一个特殊的系统用户
    const systemUser = db.prepare('SELECT id FROM users WHERE email = ?').get('system@internal');

    let systemUserId;
    if (!systemUser) {
        const result = db.prepare(`
      INSERT INTO users (email, password_hash, points)
      VALUES (?, ?, ?)
    `).run('system@internal', 'SYSTEM_USER_NO_LOGIN', 0);
        systemUserId = result.lastInsertRowid;
        console.log('✅ 创建系统用户 (用于持有初始邀请码)\n');
    } else {
        systemUserId = systemUser.id;
    }

    // 生成 20 个邀请码
    const codes = [];
    for (let i = 0; i < 20; i++) {
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
            db.prepare('INSERT INTO invite_codes (code, owner_id) VALUES (?, ?)').run(code, systemUserId);
            codes.push(code);
        }
    }

    console.log('═══════════════════════════════════════════');
    console.log('          📋 初始邀请码列表 (20个)          ');
    console.log('═══════════════════════════════════════════\n');

    codes.forEach((code, i) => {
        console.log(`  ${String(i + 1).padStart(2, '0')}. ${code}`);
    });

    console.log('\n═══════════════════════════════════════════');
    console.log('✅ 邀请码已保存到数据库');
    console.log('📌 新用户可使用以上邀请码注册');
    console.log('═══════════════════════════════════════════\n');
}

main().catch(console.error);
