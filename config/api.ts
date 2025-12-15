/**
 * API 配置管理
 * 前端不再需要 Gemini API Key，所有调用通过后端代理
 */

interface ApiConfig {
  backend: {
    baseUrl: string;
  };
}

const loadApiConfig = (): ApiConfig => {
  // 后端基础 URL
  // 生产环境使用相对路径（同源）
  // 开发环境可以通过 VITE_API_BASE_URL 配置
  // 生产环境默认使用 api.abdc.online
  const backendBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://api.abdc.online';

  return {
    backend: {
      baseUrl: backendBaseUrl,
    },
  };
};

export const apiConfig = loadApiConfig();

export const getBackendBaseUrl = () => apiConfig.backend.baseUrl;
