import axios from 'axios';

export const IS_ELECTRON_APP = !!(window as any).ipcRenderer;

export const getApiUrl = (path: string, isElectron: boolean = IS_ELECTRON_APP) => {
  if (!isElectron) return path;

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
  if (path.startsWith('/api/deepseek')) {
    return path.replace('/api/deepseek', 'https://api.deepseek.com');
  }
  if (path.startsWith('/api/gemini')) {
    return path.replace('/api/gemini', 'https://generativelanguage.googleapis.com/v1beta');
  }
  
  return path;
};

export const aiFetch = async (options: { url: string, method?: string, data?: any, headers?: any }, isElectron: boolean = IS_ELECTRON_APP) => {
  // Use IPC proxy ONLY for relative paths in Electron to bypass CORS.
  // Absolute URLs should be handled by the renderer's network stack (which has correct proxy settings).
  if (isElectron && options.url.startsWith('/api/')) {
    // Proxy through Main Process to bypass CORS
    // Convert relative proxy paths to absolute URLs for Electron
    const absoluteUrl = getApiUrl(options.url, isElectron);
    const result = await (window as any).ipcRenderer.invoke('ai-request', { ...options, url: absoluteUrl });
    if (result.error) throw new Error(result.error);
    return result;
  } else {
    // Normal axios call for web (relying on Vite proxy) or absolute URLs in Electron
    const response = await axios({
      ...options
    });
    return { data: response.data };
  }
};
