export const IS_ELECTRON_APP = !!(window as any).ipcRenderer;

export const getApiUrl = (path: string) => {
  if (!IS_ELECTRON_APP) return path;

  // Map proxy paths to absolute URLs for Electron production
  if (path.startsWith('/api/openai')) {
    return path.replace('/api/openai', 'https://api.openai.com/v1');
  }
  if (path.startsWith('/api/anthropic')) {
    return path.replace('/api/anthropic', 'https://api.anthropic.com/v1');
  }
  if (path.startsWith('/api/moonshot')) {
    return path.replace('/api/moonshot', 'https://api.moonshot.cn/v1');
  }
  if (path.startsWith('/api/glm')) {
    return path.replace('/api/glm', 'https://open.bigmodel.cn/api/paas/v4');
  }
  
  return path;
};

export const aiFetch = async (options: { url: string, method?: string, data?: any, headers?: any }) => {
  if (IS_ELECTRON_APP) {
    // Proxy through Main Process to bypass CORS
    const result = await (window as any).ipcRenderer.invoke('ai-request', options);
    if (result.error) throw new Error(result.error);
    return result;
  } else {
    // Normal axios call for web (relying on Vite proxy)
    const axios = (await import('axios')).default;
    const response = await axios({
      ...options
    });
    return { data: response.data };
  }
};
