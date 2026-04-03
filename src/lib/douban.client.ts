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

/**
 * EdgeOne 代理配置
 */
const PROXY_BASE = 'https://db.gullu.cc.cd/api';

/**
 * 带超时的 fetch 请求
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json, text/plain, */*',
        ...options.headers,
      },
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * 浏览器端豆瓣分类数据获取函数 (Rexxar API)
 */
export async function fetchDoubanCategories(
  params: DoubanCategoriesParams
): Promise<DoubanResult> {
  const { kind, category, type, pageLimit = 20, pageStart = 0 } = params;

  // 1. 构造豆瓣原始子路径
  const subPath = `/rexxar/api/v2/subject/recent_hot/${kind}?start=${pageStart}&limit=${pageLimit}&category=${category}&type=${type}`;
  
  // 2. 拼接代理地址
  const target = `${PROXY_BASE}${subPath}`;

  try {
    const response = await fetchWithTimeout(target);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const doubanData: DoubanCategoryApiResponse = await response.json();

    const list: DoubanItem[] = doubanData.items.map((item) => ({
      id: item.id,
      title: item.title,
      poster: item.pic?.normal || item.pic?.large || '',
      rate: item.rating?.value ? item.rating.value.toFixed(1) : '',
      year: item.card_subtitle?.match(/(\d{4})/)?.[1] || '',
    }));

    return {
      code: 200,
      message: '获取成功',
      list: list,
    };
  } catch (error) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('globalError', {
          detail: { message: '获取豆瓣分类数据失败' },
        })
      );
    }
    throw new Error(`获取豆瓣分类数据失败: ${(error as Error).message}`);
  }
}

interface DoubanListParams {
  tag: string;
  type: string;
  pageLimit?: number;
  pageStart?: number;
}

/**
 * 豆瓣搜索列表获取函数 (Search API)
 */
export async function fetchDoubanList(
  params: DoubanListParams
): Promise<DoubanResult> {
  const { tag, type, pageLimit = 20, pageStart = 0 } = params;

  // 1. 构造搜索接口子路径
  // 注意：边缘函数 [[path]].js 会自动识别并在缺少时补全 /rexxar/api/v2
  const subPath = `/j/search_subjects?type=${type}&tag=${tag}&sort=recommend&page_limit=${pageLimit}&page_start=${pageStart}`;
  
  // 2. 拼接代理地址
  const target = `${PROXY_BASE}${subPath}`;

  try {
    const response = await fetchWithTimeout(target);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const doubanData: any = await response.json();
    
    // 兼容 search_subjects 返回的 subjects 字段或 items 字段
    const rawItems = doubanData.subjects || doubanData.items || [];

    const list: DoubanItem[] = rawItems.map((item: any) => ({
      id: item.id,
      title: item.title,
      poster: item.cover || item.pic?.normal || '',
      rate: item.rate || item.rating?.value?.toFixed(1) || '',
      year: '', // 搜索接口通常不直接返回年份
    }));

    return {
      code: 200,
      message: '获取成功',
      list: list,
    };
  } catch (error) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('globalError', {
          detail: { message: '获取豆瓣列表数据失败' },
        })
      );
    }
    throw new Error(`获取豆瓣列表数据失败: ${(error as Error).message}`);
  }
}

/**
 * 统一封装函数
 */
export async function getDoubanCategories(params: DoubanCategoriesParams): Promise<DoubanResult> {
  return fetchDoubanCategories(params);
}

export async function getDoubanList(params: DoubanListParams): Promise<DoubanResult> {
  return fetchDoubanList(params);
}

export function shouldUseDoubanClient(): boolean {
  return true;
}
