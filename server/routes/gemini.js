/**
 * Gemini API Route
 * POST /api/gemini - 文本生成
 * POST /api/gemini/image - 图像生成 (静态文件落盘模式, 需要 JWT 鉴权)
 */
import express from 'express';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { generateContent, generateImage, formatError } from '../services/vertexai.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// 静态文件存储配置 (可通过环境变量覆盖，默认使用生产路径)
const STATIC_DIR = process.env.STATIC_DIR || '/www/generator/runtime/generated';
const STATIC_URL_BASE = process.env.STATIC_URL_BASE || 'https://api.abdc.online/generated';

/**
 * POST /api/gemini
 * 
 * Request Body:
 * {
 *   prompt: string,           // 必填
 *   temperature?: number,     // 可选, 默认 0.2
 *   maxOutputTokens?: number  // 可选, 默认 2048, 上限 4096
 * }
 * 
 * Response:
 * { text: string }
 */
router.post('/gemini', async (req, res) => {
    const startTime = Date.now();
    const { prompt, temperature, maxOutputTokens } = req.body;

    // 参数验证
    if (!prompt) {
        return res.status(400).json({
            error: { message: 'prompt is required', status: 400, code: 'INVALID_ARGUMENT' }
        });
    }

    if (typeof prompt !== 'string') {
        return res.status(400).json({
            error: { message: 'prompt must be a string', status: 400, code: 'INVALID_ARGUMENT' }
        });
    }

    try {
        const result = await generateContent(prompt, { temperature, maxOutputTokens });
        const elapsed = Date.now() - startTime;

        // 脱敏日志：不打印 prompt 和 text 内容
        console.log(`[Gemini] OK | ${elapsed}ms | promptLen=${prompt.length} | textLen=${result.text?.length || 0}`);

        res.json(result);
    } catch (err) {
        const elapsed = Date.now() - startTime;
        const status = err.status || 500;

        // 脱敏日志：只打印错误码和耗时
        console.error(`[Gemini] ERR ${status} | ${elapsed}ms | ${err.code || 'UNKNOWN'}`);

        res.status(status).json({ error: formatError(err, err.rawError) });
    }
});

/**
 * POST /api/gemini/image
 * 
 * Response:
 *   { url: string }  → Nginx 静态分发的图片 URL
 * 
 * Request Body:
 * {
 *   prompt: string,           // 必填，图像描述
 *   imageSize?: string,       // 可选, 默认 "2K"
 *   aspectRatio?: string,     // 可选, 默认 "1:1"
 *   inputImage?: string       // 可选, base64 输入图像
 * }
 */
router.post('/gemini/image', authMiddleware, async (req, res) => {
    const startTime = Date.now();
    const { prompt, imageSize, aspectRatio, inputImage } = req.body;
    const userId = req.user.id; // 从 JWT 中获取用户 ID

    // 参数验证
    if (!prompt) {
        return res.status(400).json({
            error: { message: 'prompt is required', status: 400, code: 'INVALID_ARGUMENT' }
        });
    }

    if (typeof prompt !== 'string') {
        return res.status(400).json({
            error: { message: 'prompt must be a string', status: 400, code: 'INVALID_ARGUMENT' }
        });
    }

    try {
        const result = await generateImage(prompt, { imageSize, aspectRatio, inputImage });
        const elapsed = Date.now() - startTime;

        // 二进制转换
        const buffer = Buffer.from(result.base64, 'base64');

        // 脱敏日志：不打印 prompt 和 base64，只打印元数据
        console.log(`[Gemini/Image] OK | ${elapsed}ms | size=${imageSize || '2K'} | ratio=${aspectRatio || '1:1'} | bytes=${buffer.length} | hasInput=${!!inputImage}`);
        // 确保目录存在
        await mkdir(STATIC_DIR, { recursive: true });

        // 生成文件名（基于 MIME 类型确定扩展名）
        const ext = result.mimeType === 'image/png' ? 'png' :
            result.mimeType === 'image/webp' ? 'webp' : 'jpg';
        const filename = `${randomUUID()}.${ext}`;
        const filepath = path.join(STATIC_DIR, filename);

        // 写入文件
        await writeFile(filepath, buffer);
        console.log(`[Gemini/Image] Saved to ${filepath}`);
        // 返回 JSON URL（由 Nginx 静态分发）
        res.json({ url: `${STATIC_URL_BASE}/${filename}` });

    } catch (err) {
        const elapsed = Date.now() - startTime;
        const status = err.status || 500;

        // 脱敏日志：只打印错误码和参数元数据
        console.error(`[Gemini/Image] ERR ${status} | ${elapsed}ms | ${err.code || 'UNKNOWN'} | size=${imageSize || '2K'} | ratio=${aspectRatio || '1:1'}`);

        res.status(status).json({ error: formatError(err, err.rawError) });
    }
});

/**
 * GET /api/images/:filename/download
 * 
 * JWT-authenticated image download endpoint
 * Forces browser to download instead of displaying the image
 * 
 * Response: Binary image with Content-Disposition: attachment
 */
router.get('/images/:filename/download', authMiddleware, (req, res) => {
    const { filename } = req.params;

    // Security: Validate filename to prevent path traversal attacks
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ error: 'Invalid filename' });
    }

    // Only allow image file extensions
    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
    const ext = path.extname(filename).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
        return res.status(400).json({ error: 'Invalid file type' });
    }

    const filepath = path.resolve(STATIC_DIR, filename);

    // Check file exists
    if (!existsSync(filepath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    // Determine content type
    const contentTypes = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp'
    };
    const contentType = contentTypes[ext] || 'application/octet-stream';

    // Set headers for forced download
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    console.log(`[Download] Serving ${filename} for user ${req.user.id}`);

    // Stream file to response (filepath is now absolute)
    res.sendFile(filepath, (err) => {
        if (err) {
            console.error(`[Download] Error sending file ${filename}:`, err);
            // Don't send error response if headers already sent
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to send file' });
            }
        }
    });
});

export default router;

