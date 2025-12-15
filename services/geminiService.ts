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
    throw new Error(errorData.error?.message || `API request failed: ${response.status}`);
  }

  // 成功响应是 JSON { url: string }
  const data = await response.json();
  return data.url;
};

/**
 * 分析图像风格
 * 使用后端 /api/gemini 进行文本分析
 */
export const analyzeImageStyle = async (base64Image: string): Promise<string> => {
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

  // 构建分析 prompt，包含图片
  const prompt = `Analyze this interior design image. Describe the core 'Vibe' in English, focusing on: Color Palette, Material Textures (e.g., velvet, marble, oak), Lighting Mood (e.g., natural, moody, warm), and Architectural Lines. Keep it concise but descriptive. Output ONLY the description.

[Image data attached as base64]
${cleanBase64.substring(0, 100)}...`; // 仅示意，实际需要后端支持图像分析

  try {
    // 注意：当前后端 /api/gemini 只支持纯文本
    // 如需图像分析，需要后端扩展 /api/gemini/analyze 端点
    const result = await apiRequest<{ text: string }>('/api/gemini', { prompt });
    return result.text || "Could not analyze image vibe.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw new Error("Failed to analyze image style.");
  }
};

interface GenConfig {
  temperature?: number;
  topP?: number;
}

/**
 * 生成图像变体
 * 使用后端 /api/gemini/image (二进制模式)
 */
export const generateImageVariation = async (
  prompt: string,
  base64Image: string,
  config: GenConfig = { temperature: 0.5, topP: 0.95 }
): Promise<string> => {
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

  try {
    // 使用二进制模式，返回 blob URL
    const blobUrl = await imageRequest('/api/gemini/image', {
      prompt,
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
 * 使用后端 /api/gemini/image (二进制模式)
 */
export const upscaleImage = async (base64Image: string): Promise<string> => {
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

  const upscalePrompt = `Act as a Professional Architectural Photographer and Image Restoration Expert.
Task: Upscale and Repair this image to 2K resolution.

CRITICAL INSTRUCTIONS:
1. CLARITY & RESOLUTION: Make the image crystal clear. Transform it into a High-Fidelity architectural photograph. Eliminate all blurriness, fuzziness, and low-res pixelation.
2. REPAIR & FIX: Aggressively identify and correct unrealistic structural errors, distorted objects, impossible geometry, and warping lines. Remove all AI artifacts and digital noise. Ensure furniture and architectural elements are physically logical.
3. MATERIAL & TEXTURE: Enhance wood grain, stone textures, fabric weaves, and metal reflections to be hyper-realistic and tactile.
4. REALISM: Ensure lighting, shadows, and reflections interact physically correctly.
5. PRESERVATION: Maintain 90% of the original composition and design intent, but replace low-quality details with high-definition assets.

Output: Professional Architectural Photography, 2K Resolution, Noise-free, Sharp Focus.`;

  try {
    // 使用二进制模式，返回 blob URL
    const blobUrl = await imageRequest('/api/gemini/image', {
      prompt: upscalePrompt,
      inputImage: cleanBase64,
      imageSize: '2K',
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

