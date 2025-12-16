/**
 * Vertex AI Service
 * 使用 Service Account 鉴权调用 Vertex AI Gemini API
 * 支持多区域故障转移
 */
import { GoogleAuth } from 'google-auth-library';
import dns from 'node:dns';
import { Agent } from 'undici';

// ============================================================================
// 配置
// ============================================================================
const PROJECT_ID = process.env.VERTEX_AI_PROJECT || 'vibe-design';
const MODEL = process.env.VERTEX_AI_MODEL || 'gemini-3-pro-image-preview';

// 重要：优先使用 IPv4，避免某些网络环境下 IPv6 到 googleapis/aiplatform 的不稳定
// Node 18+ 支持 setDefaultResultOrder；若不支持则忽略
try {
    dns.setDefaultResultOrder('ipv4first');
} catch (_) {
    // ignore
}

// 共享 HTTP 连接池（减少频繁建连带来的抖动 / reset）
const dispatcher = new Agent({
    connect: {
        timeout: 10_000, // TCP/TLS 建连超时
    },
    keepAliveTimeout: 60_000,
    keepAliveMaxTimeout: 120_000,
});

// 区域配置
// gemini-3-pro-image-preview 只在 global 可用
const REGIONS = [
    'global',
];

// global region 使用不同的 base URL
function getVertexBaseUrl(region) {
    return region === 'global'
        ? 'https://aiplatform.googleapis.com'
        : `https://${region}-aiplatform.googleapis.com`;
}

// 根据区域生成 endpoint
function getEndpoint(region) {
    return `${getVertexBaseUrl(region)}/v1/projects/${PROJECT_ID}/locations/${region}/publishers/google/models/${MODEL}:generateContent`;
}

// 文本生成使用固定 endpoint（目前仅 global）
const ENDPOINT = getEndpoint(REGIONS[0]);

// 启动时打印配置
console.log('[VertexAI] Project:', PROJECT_ID);
console.log('[VertexAI] Model:', MODEL);
console.log('[VertexAI] Regions (failover order):', REGIONS.join(' -> '));

const DEFAULT_CONFIG = {
    temperature: 0.2,
    maxOutputTokens: 2048,
};

const MAX_OUTPUT_TOKENS_LIMIT = 4096;
const TIMEOUT_MS = 30000; // 30 秒超时

// ============================================================================
// Token 缓存
// ============================================================================
let cachedToken = null;
let tokenExpiryTime = 0;
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 过期前 5 分钟刷新

const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

/**
 * 获取 Access Token（带缓存）
 */
async function getAccessToken() {
    const now = Date.now();

    // 如果 token 还有效，直接返回
    if (cachedToken && now < tokenExpiryTime - TOKEN_REFRESH_BUFFER_MS) {
        return cachedToken;
    }

    // 重新获取 token
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();

    if (!tokenResponse.token) {
        throw new Error('Failed to obtain access token');
    }

    cachedToken = tokenResponse.token;
    // Access token 通常 1 小时有效
    tokenExpiryTime = now + 3600 * 1000;

    return cachedToken;
}

/**
 * 清除 token 缓存（用于错误恢复）
 */
function clearTokenCache() {
    cachedToken = null;
    tokenExpiryTime = 0;
}

// ============================================================================
// 错误处理
// ============================================================================
const isProduction = process.env.NODE_ENV === 'production';

/**
 * 格式化错误响应
 */
function formatError(error, rawError = null) {
    const response = {
        message: error.message || 'Unknown error',
        status: error.status || 500,
        code: error.code || 'INTERNAL_ERROR',
    };

    // 非生产环境可以返回更多细节
    if (!isProduction && rawError) {
        response.raw = rawError;
    }

    return response;
}

// ============================================================================
// API 调用
// ============================================================================

/**
 * 调用 Vertex AI Gemini API
 * @param {string} prompt - 用户输入的 prompt
 * @param {object} options - 可选配置
 * @param {number} options.temperature - 温度参数 (0-2)
 * @param {number} options.maxOutputTokens - 最大输出 token 数
 * @returns {Promise<{text: string}>}
 */
export async function generateContent(prompt, options = {}) {
    // 参数验证
    if (!prompt || typeof prompt !== 'string') {
        const error = new Error('prompt is required and must be a string');
        error.status = 400;
        error.code = 'INVALID_ARGUMENT';
        throw error;
    }

    // 配置处理
    const temperature = options.temperature ?? DEFAULT_CONFIG.temperature;
    const maxOutputTokens = Math.min(
        options.maxOutputTokens ?? DEFAULT_CONFIG.maxOutputTokens,
        MAX_OUTPUT_TOKENS_LIMIT
    );

    // 构建请求体
    const requestBody = {
        contents: [{
            role: 'user',
            parts: [{ text: prompt }]
        }],
        generationConfig: {
            temperature,
            maxOutputTokens,
        }
    };

    // 获取 token
    let token;
    try {
        token = await getAccessToken();
    } catch (err) {
        console.error('[VertexAI] Token acquisition failed:', err.message);
        const error = new Error('Authentication failed');
        error.status = 500;
        error.code = 'AUTH_ERROR';
        throw error;
    }

    // 设置超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const response = await fetch(ENDPOINT, {
            dispatcher,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // 处理响应
        const data = await response.json();

        if (!response.ok) {
            console.error('[VertexAI] API error:', JSON.stringify(data, null, 2));

            // Token 过期时清除缓存
            if (response.status === 401) {
                clearTokenCache();
            }

            const error = new Error(data.error?.message || `API request failed with status ${response.status}`);
            error.status = response.status;
            error.code = data.error?.code || 'API_ERROR';
            error.rawError = data;
            throw error;
        }

        // 提取文本响应
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            console.error('[VertexAI] No text in response:', JSON.stringify(data, null, 2));
            const error = new Error('No text content in response');
            error.status = 500;
            error.code = 'EMPTY_RESPONSE';
            throw error;
        }

        return { text };

    } catch (err) {
        clearTimeout(timeoutId);

        // 超时处理
        if (err.name === 'AbortError') {
            const error = new Error('Request timeout after 30 seconds');
            error.status = 504;
            error.code = 'TIMEOUT';
            throw error;
        }

        // 重新抛出已格式化的错误
        if (err.status) {
            throw err;
        }

        // 网络错误等
        console.error('[VertexAI] Unexpected error:', {
            message: err.message,
            name: err.name,
            code: err.code,
            cause: err.cause?.message,
        });
        const error = new Error('Failed to connect to Vertex AI');
        error.status = 502;
        error.code = 'NETWORK_ERROR';
        throw error;
    }
}

// ============================================================================
// 图像生成 API
// ============================================================================

const IMAGE_TIMEOUT_MS = 300000; // 图像生成超时 300s (与 Nginx 超时匹配)

// 重试配置 (针对 429 RESOURCE_EXHAUSTED 错误)
// 总等待时间约 2 分钟: 30s + 40s + 50s ≈ 120s
const RETRY_CONFIG = {
    maxRetries: 3,           // 3 次重试
    baseDelayMs: 30000,      // 第一次重试等待 30s
    maxDelayMs: 50000,       // 最大等待 50s
    backoffMultiplier: 1.3,  // 较小的退避倍数
};

/**
 * 延迟函数
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 计算指数退避延迟时间
 */
function getRetryDelay(attempt) {
    const delayMs = RETRY_CONFIG.baseDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt);
    // 添加 10% 的随机抖动
    const jitter = delayMs * 0.1 * Math.random();
    return Math.min(delayMs + jitter, RETRY_CONFIG.maxDelayMs);
}

/**
 * 执行单次图像生成请求 (带详细 429 诊断日志)
 * @param {object} requestBody - 请求体
 * @param {string} token - Access Token
 * @param {string} region - 目标区域
 */
async function executeImageRequest(requestBody, token, region) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
    const started = Date.now();
    const endpoint = getEndpoint(region);

    try {
        const response = await fetch(endpoint, {
            dispatcher,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const elapsed = Date.now() - started;

        // 先读取原始文本（即使失败也能读）
        const rawText = await response.text();
        const headers = Object.fromEntries(response.headers.entries());

        if (!response.ok) {
            // 尝试解析 JSON
            let data = {};
            try {
                data = JSON.parse(rawText);
            } catch (_) {
                // 不是 JSON
            }

            // 429 错误时打印完整诊断信息
            if (response.status === 429) {
                console.error('[VertexAI][429 DIAGNOSTIC] ===========================');
                console.error('[VertexAI][429] region:', region);
                console.error('[VertexAI][429] status:', response.status, response.statusText);
                console.error('[VertexAI][429] elapsed:', elapsed + 'ms');
                console.error('[VertexAI][429] headers:', JSON.stringify(headers, null, 2));
                console.error('[VertexAI][429] body (raw):', rawText.slice(0, 5000));

                // 关键：打印 error.details（如果有 QuotaFailure/violations 就是配额问题）
                if (data.error?.details) {
                    console.error('[VertexAI][429] error.details:', JSON.stringify(data.error.details, null, 2));
                } else {
                    console.error('[VertexAI][429] error.details: (none - likely DSQ/shared capacity issue)');
                }
                console.error('[VertexAI][429 DIAGNOSTIC] ===========================');
            } else {
                console.error('[VertexAI] Image API error:', JSON.stringify(data, null, 2));
            }

            if (response.status === 401) {
                clearTokenCache();
            }

            const error = new Error(data.error?.message || `API request failed with status ${response.status}`);
            error.status = response.status;
            error.code = data.error?.code || 'API_ERROR';
            error.rawError = data;
            throw error;
        }

        // 成功时解析 JSON
        const data = JSON.parse(rawText);

        // 提取图像响应
        const part = data.candidates?.[0]?.content?.parts?.[0];
        const base64 = part?.inlineData?.data;
        const mimeType = part?.inlineData?.mimeType || 'image/png';

        if (!base64) {
            console.error('[VertexAI] No image in response:', JSON.stringify(data, null, 2));
            const error = new Error('No image content in response');
            error.status = 500;
            error.code = 'EMPTY_RESPONSE';
            throw error;
        }

        return { mimeType, base64 };

    } catch (err) {
        clearTimeout(timeoutId);

        if (err.name === 'AbortError') {
            const error = new Error('Request timeout after 300 seconds');
            error.status = 504;
            error.code = 'TIMEOUT';
            throw error;
        }

        if (err.status) {
            throw err;
        }

        console.error('[VertexAI] Unexpected error:', {
            message: err.message,
            name: err.name,
            code: err.code,
            cause: err.cause?.message,
            region,
        });
        const error = new Error('Failed to connect to Vertex AI');
        error.status = 502;
        error.code = 'NETWORK_ERROR';
        throw error;
    }
}

/**
 * 生成图像 (带 429 重试)
 * @param {string} prompt - 图像描述
 * @param {object} options - 配置
 * @param {string} options.imageSize - 图像尺寸 (如 "2K")
 * @param {string} options.aspectRatio - 宽高比 (如 "4:5", "1:1", "16:9")
 * @param {string} options.inputImage - 可选，输入图像的 base64
 * @returns {Promise<{mimeType: string, base64: string}>}
 */
export async function generateImage(prompt, options = {}) {
    // 参数验证
    if (!prompt || typeof prompt !== 'string') {
        const error = new Error('prompt is required and must be a string');
        error.status = 400;
        error.code = 'INVALID_ARGUMENT';
        throw error;
    }

    const imageSize = options.imageSize || '2K';
    const aspectRatio = options.aspectRatio || '1:1';

    // 构建 parts
    const parts = [];

    // 如果有输入图像，添加到 parts
    if (options.inputImage) {
        const cleanBase64 = options.inputImage.replace(/^data:image\/\w+;base64,/, '');
        parts.push({
            inlineData: {
                mimeType: 'image/jpeg',
                data: cleanBase64
            }
        });
    }

    // 添加 prompt
    parts.push({ text: prompt });

    // 构建请求体
    const requestBody = {
        contents: [{
            role: 'user',
            parts
        }],
        generationConfig: {
            responseModalities: ['Image'],
            imageConfig: {
                imageSize,
                aspectRatio
            },
            maxOutputTokens: 4096
        }
    };

    // 获取 token
    let token;
    try {
        token = await getAccessToken();
    } catch (err) {
        console.error('[VertexAI] Token acquisition failed:', err.message);
        const error = new Error('Authentication failed');
        error.status = 500;
        error.code = 'AUTH_ERROR';
        throw error;
    }

    // 多区域故障转移 + 时间退避重试
    // 策略：遇到 429 立即切换到下一个区域，所有区域都 429 后等待一段时间再重试
    let lastError;

    for (let round = 0; round <= RETRY_CONFIG.maxRetries; round++) {
        // 如果不是第一轮，需要等待
        if (round > 0) {
            const delayMs = getRetryDelay(round - 1);
            console.log(`[VertexAI] All regions exhausted, waiting ${Math.round(delayMs / 1000)}s before retry round ${round + 1}/${RETRY_CONFIG.maxRetries + 1}`);
            await delay(delayMs);

            // 刷新 token
            try {
                token = await getAccessToken();
            } catch (tokenErr) {
                console.error('[VertexAI] Token refresh failed:', tokenErr.message);
            }
        }

        // 遍历所有区域
        for (let regionIdx = 0; regionIdx < REGIONS.length; regionIdx++) {
            const region = REGIONS[regionIdx];

            try {
                console.log(`[VertexAI] Trying region: ${region} (round ${round + 1}, region ${regionIdx + 1}/${REGIONS.length})`);
                const result = await executeImageRequest(requestBody, token, region);
                console.log(`[VertexAI] Success with region: ${region}`);
                return result;
            } catch (err) {
                lastError = err;

                // 429 或 404 错误：立即尝试下一个区域，不等待
                // 429 = 资源耗尽，404 = 模型在该区域不存在
                if (err.status === 429 || err.status === 404) {
                    console.log(`[VertexAI] Region ${region} returned ${err.status}, trying next region...`);
                    continue; // 尝试下一个区域
                }

                // 其他错误：直接抛出，不重试
                throw err;
            }
        }

        // 所有区域都 429 了，继续下一轮
        console.log(`[VertexAI] All ${REGIONS.length} regions returned 429`);
    }

    // 所有重试都失败了
    console.error(`[VertexAI] All retry rounds exhausted`);
    throw lastError;
}

export { formatError };
