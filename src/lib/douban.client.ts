import { DoubanItem, DoubanResult } from './types';

const PROXY_BASE = 'https://db.gullu.cc.cd/api';

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { 'Accept': 'application/json', ...options.headers }
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export async function fetchDoubanCategories(params: any): Promise<DoubanResult> {
  const { kind, category, type, pageLimit = 20, pageStart = 0 } = params;
  // 构造子路径，边缘函数会自动识别并补全
  const subPath = `/rexxar/api/v2/subject/recent_hot/${kind}?start=${pageStart}&limit=${pageLimit}&category=${category}&type=${type}`;
  
  try {
    const response = await fetchWithTimeout(`${PROXY_BASE}${subPath}`);
    const doubanData = await response.json();

    const list: DoubanItem[] = doubanData.items.map((item: any) => ({
      id: item.id,
      title: item.title,
      poster: item.pic?.normal || item.pic?.large || '',
      rate: item.rating?.value ? item.rating.value.toFixed(1) : '暂无',
      year: item.card_subtitle?.match(/(\d{4})/)?.[1] || ''
    }));

    return { code: 200, message: 'OK', list };
  } catch (error) {
    throw new Error(`请求失败: ${(error as Error).message}`);
  }
}

export async function fetchDoubanList(params: any): Promise<DoubanResult> {
  const { tag, type, pageLimit = 20, pageStart = 0 } = params;
  const subPath = `/j/search_subjects?type=${type}&tag=${tag}&page_limit=${pageLimit}&page_start=${pageStart}`;

  try {
    const response = await fetchWithTimeout(`${PROXY_BASE}${subPath}`);
    const data = await response.json();
    const rawItems = data.subjects || data.items || [];

    const list: DoubanItem[] = rawItems.map((item: any) => ({
      id: item.id,
      title: item.title,
      poster: item.cover || item.pic?.normal || '',
      rate: item.rate || item.rating?.value?.toFixed(1) || '',
      year: ''
    }));
    return { code: 200, message: 'OK', list };
  } catch (error) {
    throw error;
  }
}

export const getDoubanCategories = fetchDoubanCategories;
export const getDoubanList = fetchDoubanList;
export function shouldUseDoubanClient() { return true; }
