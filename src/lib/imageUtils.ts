export const getOptimizedImage = (url: string, width = 600) => {
  if (!url) return '';
  
  // If it's a data URL (Base64), return as is
  if (url.startsWith('data:')) return url;
  
  // If it's an Unsplash image, optimize it
  if (url.includes('unsplash.com')) {
    const baseUrl = url.split('?')[0];
    return `${baseUrl}?auto=format&fit=crop&q=80&w=${width}`;
  }
  
  // If it's a relative path, assume it's served from the root
  // (In this setup, standard static assets or uploads should be handled by the server)
  return url;
};
