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
import { buildGenerationPrompt, getGenerationConfig } from '../services/prompts.js';
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
 *   tags?: string[],          // 空间标签数组 (可选, 默认 [])
 *   level?: number,           // 创意等级 1-5 (可选, 默认 3)
 *   imageSize?: string,       // 可选, 默认 "2K"
 *   aspectRatio?: string,     // 可选, 默认 "1:1"
 *   inputImage?: string       // 可选, base64 输入图像
 * }
 */
router.post('/gemini/image', authMiddleware, async (req, res) => {
    const startTime = Date.now();
    const { tags, level, imageSize, aspectRatio, inputImage } = req.body;
    const userId = req.user.id; // 从 JWT 中获取用户 ID

    // 参数验证
    const safeTags = Array.isArray(tags) ? tags : [];
    const safeLevel = typeof level === 'number' && level >= 1 && level <= 5 ? level : 3;

    // 在服务端构建完整 prompt（不暴露给前端）
    const prompt = buildGenerationPrompt(safeTags, safeLevel);
    const config = getGenerationConfig(safeLevel);

    try {
        const result = await generateImage(prompt, { imageSize, aspectRatio, inputImage });
        const elapsed = Date.now() - startTime;

        // 二进制转换
        const buffer = Buffer.from(result.base64, 'base64');

        // 脱敏日志：只打印标签数和等级，不打印 prompt
        console.log(`[Gemini/Image] OK | ${elapsed}ms | tags=${safeTags.length} | level=${safeLevel} | size=${imageSize || '2K'} | ratio=${aspectRatio || '1:1'} | bytes=${buffer.length} | hasInput=${!!inputImage}`);
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

// 放大/修复专用提示词（服务端保密）
const UPSCALE_PROMPT = `Act as a Professional Architectural Photographer and Image Restoration Expert.
Task: Upscale and Repair this image to 2K resolution.

CRITICAL INSTRUCTIONS:
1. CLARITY & RESOLUTION: Make the image crystal clear. Transform it into a High-Fidelity architectural photograph. Eliminate all blurriness, fuzziness, and low-res pixelation.
2. REPAIR & FIX: Aggressively identify and correct unrealistic structural errors, distorted objects, impossible geometry, and warping lines. Remove all AI artifacts and digital noise. Ensure furniture and architectural elements are physically logical.
3. MATERIAL & TEXTURE: Enhance wood grain, stone textures, fabric weaves, and metal reflections to be hyper-realistic and tactile.
4. REALISM: Ensure lighting, shadows, and reflections interact physically correctly.
5. PRESERVATION: Maintain 90% of the original composition and design intent, but replace low-quality details with high-definition assets.

Output: Professional Architectural Photography, 2K Resolution, Noise-free, Sharp Focus.`;

/**
 * POST /api/gemini/upscale
 * 
 * 放大/修复图像端点，使用固定的专用提示词
 * 
 * Request Body:
 * {
 *   inputImage: string       // 必填, base64 输入图像
 * }
 * 
 * Response:
 *   { url: string }  → Nginx 静态分发的图片 URL
 */
router.post('/gemini/upscale', authMiddleware, async (req, res) => {
    const startTime = Date.now();
    const { inputImage } = req.body;
    const userId = req.user.id;

    // 参数验证
    if (!inputImage) {
        return res.status(400).json({
            error: { message: 'inputImage is required', status: 400, code: 'INVALID_ARGUMENT' }
        });
    }

    try {
        // 使用服务端保密的放大提示词
        const result = await generateImage(UPSCALE_PROMPT, { imageSize: '2K', inputImage });
        const elapsed = Date.now() - startTime;

        // 二进制转换
        const buffer = Buffer.from(result.base64, 'base64');

        console.log(`[Gemini/Upscale] OK | ${elapsed}ms | userId=${userId} | bytes=${buffer.length}`);

        // 确保目录存在
        await mkdir(STATIC_DIR, { recursive: true });

        // 生成文件名
        const ext = result.mimeType === 'image/png' ? 'png' :
            result.mimeType === 'image/webp' ? 'webp' : 'jpg';
        const filename = `upscaled_${randomUUID()}.${ext}`;
        const filepath = path.join(STATIC_DIR, filename);

        // 写入文件
        await writeFile(filepath, buffer);
        console.log(`[Gemini/Upscale] Saved to ${filepath}`);

        // 返回 JSON URL
        res.json({ url: `${STATIC_URL_BASE}/${filename}` });

    } catch (err) {
        const elapsed = Date.now() - startTime;
        const status = err.status || 500;

        console.error(`[Gemini/Upscale] ERR ${status} | ${elapsed}ms | ${err.code || 'UNKNOWN'}`);

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

