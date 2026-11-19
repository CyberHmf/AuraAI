/**
 * Compresses an image dataURL (base64) down to a lightweight 512x512 JPEG (~30KB).
 * In Gemini Vision and OpenRouter, a compressed 512x512 JPEG costs only ~258 fixed vision tokens
 * (less than $0.00003, compared to hundreds of thousands of tokens if sent as raw text in chat).
 */
export async function compressImageForVision(
  dataUrl: string, 
  maxDim: number = 512, 
  quality: number = 0.8
): Promise<string> {
  if (!dataUrl || dataUrl.startsWith('data:image/svg')) {
    return dataUrl;
  }
  const isLoadable = dataUrl.startsWith('data:image/') || dataUrl.startsWith('/api/images/') || dataUrl.startsWith('http://') || dataUrl.startsWith('https://');
  if (!isLoadable) {
    return dataUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export async function cropFaceAndShouldersForVision(
  dataUrl: string,
  maxDim: number = 512,
  quality: number = 0.85
): Promise<string> {
  if (!dataUrl || dataUrl.startsWith('data:image/svg')) {
    return dataUrl;
  }
  const isLoadable = dataUrl.startsWith('data:image/') || dataUrl.startsWith('/api/images/') || dataUrl.startsWith('http://') || dataUrl.startsWith('https://');
  if (!isLoadable) {
    return dataUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const { width, height } = img;
      // Crop strictly upper center (face, head, shoulders) to exclude background environments (bars, counters)
      const sx = Math.round(width * 0.15);
      const sy = 0;
      const sw = Math.round(width * 0.70);
      const sh = Math.round(height * 0.62);

      const canvas = document.createElement('canvas');
      canvas.width = maxDim;
      canvas.height = maxDim;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, maxDim, maxDim);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
