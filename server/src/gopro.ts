import axios, { AxiosInstance } from 'axios';
import { MediaItem } from './types';

export function createGoProClient(token: string): AxiosInstance {
  return axios.create({
    baseURL: 'https://api.gopro.com',
    headers: {
      Cookie: token,
      Accept: 'application/vnd.gopro.jk.media+json; version=2.0.0',
    },
  });
}

export async function validateToken(token: string): Promise<boolean> {
  try {
    const client = createGoProClient(token);
    await client.get('/media/search', {
      params: { type: 'Video', per_page: 1, page: 1 },
    });
    return true;
  } catch {
    return false;
  }
}

interface GoProMediaResponse {
  _embedded: {
    media: Array<{
      id: string;
      token: string;
      filename: string;
      file_size: number;
      captured_at: string;
      type: string;
      _embedded?: {
        files?: Array<{ url: string; head: string; item_number: number }>;
        variations?: Array<{ type: string; url: string; head: string }>;
      };
    }>;
  };
  _pages: {
    count: number;
    total_items: number;
    total_pages: number;
    current_page: number;
    per_page: number;
  };
}

export async function* listAllVideos(
  token: string,
  onPage: (scanned: number, total: number | null) => void
): AsyncGenerator<MediaItem> {
  const client = createGoProClient(token);
  let page = 1;
  let totalPages = 1;
  let totalItems: number | null = null;
  let scanned = 0;

  do {
    const response = await client.get<GoProMediaResponse>('/media/search', {
      params: {
        type: 'Video',
        fields: 'file_size,filename,id,token,captured_at,type,_embedded',
        order_by: 'captured_at',
        order: 'desc',
        per_page: 100,
        page,
      },
    });

    const { _embedded, _pages } = response.data;
    totalPages = _pages.total_pages;
    totalItems = _pages.total_items;

    for (const item of _embedded.media) {
      if (item.type !== 'Video') continue;
      scanned++;
      onPage(scanned, totalItems);
      yield {
        id: item.id,
        filename: item.filename,
        size: item.file_size,
        capturedAt: item.captured_at,
      };
    }

    page++;
  } while (page <= totalPages);
}

export async function getDownloadUrl(token: string, mediaId: string): Promise<string> {
  const client = createGoProClient(token);

  try {
    const response = await client.get(`/media/${mediaId}/download`);
    const files = response.data?._embedded?.files;
    if (files && files.length > 0) return files[0].url;
  } catch {
    // fall through to direct media fetch
  }

  const response = await client.get<{ _embedded: { files: Array<{ url: string }> } }>(
    `/media/${mediaId}`,
    { params: { fields: '_embedded' } }
  );
  const files = response.data?._embedded?.files;
  if (!files || files.length === 0) {
    throw new Error(`No download URL found for media ${mediaId}`);
  }
  return files[0].url;
}
