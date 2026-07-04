import { DoubanItem, DoubanResult } from './types';

interface DoubanCategoriesParams {
  kind: 'tv' | 'movie';
  category: string;
  type: string;
  pageLimit?: number;
  pageStart?: number;
}

interface DoubanCategoryApiResponse {
  total: number;
  items: Array<{
    id: string;
    title: string;
    card_subtitle: string;
    pic: {
      large: string;
      normal: string;
    };
    rating: {
      value: number;
    };
  }>;
}

// 🎯 你的腾讯云 EdgeOne 独家统一代理网关（数据和图片全部走这里）
const FIXED_PROXY_BASE = 'https://doubandali.gullu.cc.cd/api/';

/**
 * 🛠️ 核心修改：将海报的原图链接，包装成你的腾讯云代理路径
 * 转换示例：https://img3.doubanio.com/view/... -> https://doubandali.gullu.cc.cd/api/https%3A%2F%2Fimg3.doubanio.com%2Fview%2F...
 */
function wrapImageWithProxy(rawUrl: string): string {
  if (!rawUrl) return '';
  
  let cleanedUrl = rawUrl;
  if (rawUrl.includes('%3A%2F%2F')) {
    cleanedUrl = decodeURIComponent(rawUrl);
  }
  
  // 提取出纯净的 doubanio.com 官方路径并进行编码，拼接到你的云函数后面
  if (cleanedUrl.includes('doubanio.com')) {
    const match = cleanedUrl.match(/https?:\/\/[^\/]+.doubanio.com\/.*/);
    if (match) {
      return `${FIXED_PROXY_BASE}${encodeURIComponent(match[0])}`;
    }
  }
  
  return `${FIXED_PROXY_BASE}${encodeURIComponent(cleanedUrl)}`;
}

/**
 * 带超时的 fetch 请求（数据 API 专用）
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  let finalUrl = url;
  if (url.startsWith('https://m.douban.com/rexxar/api/v2/')) {
    finalUrl = url.replace('https://m.douban.com/rexxar/api/v2/', FIXED_PROXY_BASE);
  } else if (url.startsWith('https://movie.douban.com/')) {
    finalUrl = url.replace('https://movie.douban.com/', FIXED_PROXY_BASE);
  }

  const fetchOptions: RequestInit = {
    ...options,
    signal: controller.signal,
    headers: {
      Accept: 'application/json, text/plain, */*',
      ...options.headers,
    },
  };

  try {
    const response = await fetch(finalUrl, fetchOptions);
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export function shouldUseDoubanClient(): boolean {
  return true;
}

export async function fetchDoubanCategories(
  params: DoubanCategoriesParams
): Promise<DoubanResult> {
  const { kind, category, type, pageLimit = 20, pageStart = 0 } = params;

  if (!['tv', 'movie'].includes(kind)) throw new Error('kind 参数必须是 tv 或 movie');
  if (!category || !type) throw new Error('category 和 type 参数不能为空');

  const target = `https://m.douban.com/rexxar/api/v2/subject/recent_hot/${kind}?start=${pageStart}&limit=${pageLimit}&category=${category}&type=${type}`;

  try {
    const response = await fetchWithTimeout(target);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

    const doubanData: DoubanCategoryApiResponse = await response.json();

    const list: DoubanItem[] = (doubanData.items || []).map((item) => ({
      id: item.id,
      title: item.title,
      poster: wrapImageWithProxy(item.pic?.normal || item.pic?.large || ''), // 统一走云函数中转
      rate: item.rating?.value ? item.rating.value.toFixed(1) : '',
      year: item.card_subtitle?.match(/(\d{4})/)?.[1] || '',
    }));

    return { code: 200, message: '获取成功', list };
  } catch (error) {
    throw new Error(`获取豆瓣分类数据失败: ${(error as Error).message}`);
  }
}

export async function getDoubanCategories(params: DoubanCategoriesParams): Promise<DoubanResult> {
  return fetchDoubanCategories(params);
}

interface DoubanListParams { tag: string; type: string; pageLimit?: number; pageStart?: number; }

export async function getDoubanList(params: DoubanListParams): Promise<DoubanResult> {
  return fetchDoubanList(params);
}

export async function fetchDoubanList(params: DoubanListParams): Promise<DoubanResult> {
  const { tag, type, pageLimit = 20, pageStart = 0 } = params;

  const target = `https://movie.douban.com/j/search_subjects?type=${type}&tag=${tag}&sort=recommend&page_limit=${pageLimit}&page_start=${pageStart}`;

  try {
    const response = await fetchWithTimeout(target);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

    const doubanData: DoubanCategoryApiResponse = await response.json();

    const list: DoubanItem[] = (doubanData.items || []).map((item) => ({
      id: item.id,
      title: item.title,
      poster: wrapImageWithProxy(item.pic?.normal || item.pic?.large || ''), // 统一走云函数中转
      rate: item.rating?.value ? item.rating.value.toFixed(1) : '',
      year: item.card_subtitle?.match(/(\d{4})/)?.[1] || '',
    }));

    return { code: 200, message: '获取成功', list };
  } catch (error) {
    throw new Error(`获取豆瓣分类数据失败: ${(error as Error).message}`);
  }
}
