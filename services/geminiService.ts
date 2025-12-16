/**
 * Gemini API Service
 * 通过后端代理调用 Vertex AI，不再直连 Google API
 * 
 * 后端接口:
 * - POST /api/gemini → 文本生成
 * - POST /api/gemini/image → 图像生成 (返回 JSON { url } 供 Nginx 静态分发)
 */

// 获取后端 API 基础路径
// 开发环境使用 VITE_API_BASE_URL（或 localhost）
// 生产环境默认使用 api.abdc.online
const getApiBase = (): string => {
  return import.meta.env.VITE_API_BASE_URL || 'https://api.abdc.online';
};

// 规范化 URL，避免双斜杠
function normalizeUrl(base: string, path: string): string {
  const cleanBase = base.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

/**
 * 获取存储的 auth token
 */
const getAuthToken = (): string | null => {
  return localStorage.getItem('auth_token');
};

/**
 * 处理 401 未授权响应
 * 清除 token 并跳转登录页
 */
const handleUnauthorized = () => {
  localStorage.removeItem('auth_token');
  // 触发自定义事件，让 App 组件处理登出逻辑
  window.dispatchEvent(new CustomEvent('auth:unauthorized'));
};

/**
 * 构建带认证的请求头
 */
const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

/**
 * 通用 API 请求封装 (JSON 响应)
 * 自动添加 Authorization header
 */
const apiRequest = async <T>(endpoint: string, body: object): Promise<T> => {
  const response = await fetch(normalizeUrl(getApiBase(), endpoint), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });

  // 处理 401 未授权
  if (response.status === 401) {
    handleUnauthorized();
    throw new Error('登录已过期，请重新登录');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    throw new Error(errorData.error?.message || `API request failed: ${response.status}`);
  }

  return response.json();
};

/**
 * 将 API 错误转换为用户友好的中文提示
 */
const translateError = (status: number, message: string): string => {
  // 根据状态码和消息内容翻译
  if (status === 429 || message.includes('RESOURCE_EXHAUSTED')) {
    return '当前使用人数较多，系统正在排队处理，请稍后重试';
  }
  if (status === 504 || message.includes('TIMEOUT') || message.includes('timeout')) {
    return '生成超时，服务器响应较慢，请稍后重试';
  }
  if (status === 502 || message.includes('NETWORK_ERROR')) {
    return '服务连接异常，请稍后重试';
  }
  if (status === 500 || message.includes('INTERNAL')) {
    return '服务器繁忙，请稍后重试';
  }
  if (status === 400) {
    return '请求参数有误，请检查输入';
  }
  // 默认返回原始消息
  return message || '生成失败，请重试';
};

/**
 * 图像生成请求 (JSON URL 响应)
 * 返回静态图片 URL
 * 自动添加 Authorization header
 */
const imageRequest = async (endpoint: string, body: object): Promise<string> => {
  const response = await fetch(normalizeUrl(getApiBase(), endpoint), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });

  // 处理 401 未授权
  if (response.status === 401) {
    handleUnauthorized();
    throw new Error('登录已过期，请重新登录');
  }

  if (!response.ok) {
    // 错误响应是 JSON
    const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    const rawMessage = errorData.error?.message || `API request failed: ${response.status}`;
    throw new Error(translateError(response.status, rawMessage));
  }

  // 成功响应是 JSON { url: string }
  const data = await response.json();
  return data.url;
};

/**
 * 生成图像变体
 * 使用后端 /api/gemini/image
 * 前端只发送标签和等级，prompt 在后端构建
 */
export const generateImageVariation = async (
  tags: string[],
  level: number,
  base64Image: string
): Promise<string> => {
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

  try {
    // 只发送标签和等级，不发送完整 prompt
    const blobUrl = await imageRequest('/api/gemini/image', {
      tags,
      level,
      inputImage: cleanBase64,
      imageSize: '2K',
      aspectRatio: '1:1',
    });

    return blobUrl;
  } catch (error) {
    console.error("Gemini Image Gen Error:", error);
    throw error;
  }
};

/**
 * 放大/修复图像
 * 使用后端 /api/gemini/upscale (专用端点，prompt 在后端保密)
 */
export const upscaleImage = async (base64Image: string): Promise<string> => {
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

  try {
    // 只发送图片，prompt 在后端保密
    const blobUrl = await imageRequest('/api/gemini/upscale', {
      inputImage: cleanBase64,
    });

    return blobUrl;
  } catch (error) {
    console.error("Upscale Error:", error);
    throw error;
  }
};

/**
 * Download image via authenticated endpoint
 * Uses fetch + blob approach to trigger browser download
 * @param imageUrl - Full URL or just filename of the image (e.g., https://api.abdc.online/generated/xxx.png or xxx.png)
 * @param downloadFilename - Filename to save as (e.g., upscaled_123.png)
 */
export const downloadImage = async (imageUrl: string, downloadFilename: string): Promise<void> => {
  // Extract filename from URL if it's a full URL
  const urlFilename = imageUrl.split('/').pop() || downloadFilename;

  const response = await fetch(
    normalizeUrl(getApiBase(), `/api/images/${urlFilename}/download`),
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`,
      },
    }
  );

  // Handle 401 unauthorized
  if (response.status === 401) {
    handleUnauthorized();
    throw new Error('登录已过期，请重新登录');
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Download failed: ${response.status} - ${errorText}`);
  }

  // Convert to blob and trigger download
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = downloadFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up blob URL after download triggers
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

