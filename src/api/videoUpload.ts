import { ApiError, ensureFreshToken, mediaBaseUrl } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import type { ProblemDetails, VideoUploadDto } from '@/types/api';

// Envío de un trozo con XMLHttpRequest: fetch no informa del progreso de subida ni permite abortar limpiamente.
export function uploadVideoChunk(
  squadId: string,
  uploadId: string,
  index: number,
  chunk: Blob,
  onProgress: (sentBytes: number) => void,
  signal?: AbortSignal,
): Promise<VideoUploadDto> {
  const auth = useAuthStore();
  const token = auth.token;

  return new Promise<VideoUploadDto>((resolve, reject) => {
    try {
      ensureFreshToken(token);
    } catch (e) {
      reject(e);
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', `${mediaBaseUrl}/media/squads/${squadId}/video-uploads/${uploadId}/chunks/${index}`);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.setRequestHeader('Accept', 'application/json');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(event.loaded); };

    xhr.onload = () => {
      let data: unknown = null;
      try { data = xhr.responseText ? JSON.parse(xhr.responseText) : null; } catch { /* sin cuerpo JSON */ }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data as VideoUploadDto);
      } else {
        if (xhr.status === 401 && token) auth.expire(token);
        reject(new ApiError(xhr.status, (data as ProblemDetails | null) ?? { status: xhr.status, title: xhr.statusText }));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, { title: 'Sin conexión', detail: 'Se ha perdido la conexión durante la subida.' }));
    xhr.onabort = () => reject(new DOMException('Subida cancelada', 'AbortError'));

    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(chunk);
  });
}
