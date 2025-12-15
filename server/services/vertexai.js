/**
 * Vertex AI Service
 * 使用 Service Account 鉴权调用 Vertex AI Gemini API
 */
import { GoogleAuth } from 'google-auth-library';

// ============================================================================
// 配置
// ============================================================================
const PROJECT_ID = process.env.VERTEX_AI_PROJECT || 'vibe-design';
const REGION = process.env.VERTEX_AI_REGION || 'asia-southeast1';
const MODEL = process.env.VERTEX_AI_MODEL || 'gemini-3-pro-image-preview';

// global region 使用不同的 base URL
function getVertexBaseUrl(region) {
    return region === 'global'
        ? 'https://aiplatform.googleapis.com'
        : `https://${region}-aiplatform.googleapis.com`;
}

const ENDPOINT = `${getVertexBaseUrl(REGION)}/v1/projects/${PROJECT_ID}/locations/${REGION}/publishers/google/models/${MODEL}:generateContent`;

// 启动时打印 endpoint 便于验证
console.log('[VertexAI] Endpoint:', ENDPOINT);

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
        console.error('[VertexAI] Unexpected error:', err.message);
        const error = new Error('Failed to connect to Vertex AI');
        error.status = 502;
        error.code = 'NETWORK_ERROR';
        throw error;
    }
}

// ============================================================================
// 图像生成 API
// ============================================================================

const IMAGE_TIMEOUT_MS = 60000; // 图像生成需要更长超时 (60s)

/**
 * 生成图像
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

    // 设置超时 (图像生成需要更长时间)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);

    try {
        const response = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data = await response.json();

        if (!response.ok) {
            console.error('[VertexAI] Image API error:', JSON.stringify(data, null, 2));

            if (response.status === 401) {
                clearTokenCache();
            }

            const error = new Error(data.error?.message || `API request failed with status ${response.status}`);
            error.status = response.status;
            error.code = data.error?.code || 'API_ERROR';
            error.rawError = data;
            throw error;
        }

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
            const error = new Error('Request timeout after 60 seconds');
            error.status = 504;
            error.code = 'TIMEOUT';
            throw error;
        }

        if (err.status) {
            throw err;
        }

        console.error('[VertexAI] Unexpected error:', err.message);
        const error = new Error('Failed to connect to Vertex AI');
        error.status = 502;
        error.code = 'NETWORK_ERROR';
        throw error;
    }
}

export { formatError };
