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
 * EdgeOne 代理基础地址
 * 必须以 /api 结尾以匹配你的边缘函数路由规则
 */
const PROXY_BASE = 'https://db.gullu.cc.cd/api';

/**
 * 统一的 fetch 请求封装
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
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
 * 获取豆瓣分类数据 (Rexxar 接口)
 */
export async function fetchDoubanCategories(
  params: DoubanCategoriesParams
): Promise<DoubanResult> {
  const { kind, category, type, pageLimit = 20, pageStart = 0 } = params;

  // 构造子路径。边缘函数 [[path]].js 会自动识别并补全 /rexxar/api/v2
  const subPath = `/rexxar/api/v2/subject/recent_hot/${kind}?start=${pageStart}&limit=${pageLimit}&category=${category}&type=${type}`;
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
      // 注意：图片显示需要 index.html 中有 <meta name="referrer" content="no-referrer">
      poster: item.pic?.normal || item.pic?.large || '',
      rate: item.rating?.value ? item.rating.value.toFixed(1) : '暂无',
      year: item.card_subtitle?.match(/(\d{4})/)?.[1] || '',
    }));

    return {
      code: 200,
      message: '获取成功',
      list: list,
    };
  } catch (error) {
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
 * 获取豆瓣列表数据 (搜索/标签接口)
 */
export async function fetchDoubanList(
  params: DoubanListParams
): Promise<DoubanResult> {
  const { tag, type, pageLimit = 20, pageStart = 0 } = params;

  // 构造搜索接口子路径
  const subPath = `/j/search_subjects?type=${type}&tag=${tag}&sort=recommend&page_limit=${pageLimit}&page_start=${pageStart}`;
  const target = `${PROXY_BASE}${subPath}`;

  try {
    const response = await fetchWithTimeout(target);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const doubanData: any = await response.json();
    const rawItems = doubanData.subjects || doubanData.items || [];

    const list: DoubanItem[] = rawItems.map((item: any) => ({
      id: item.id,
      title: item.title,
      poster: item.cover || item.pic?.normal || '',
      rate: item.rate || item.rating?.value?.toFixed(1) || '暂无',
      year: '',
    }));

    return {
      code: 200,
      message: '获取成功',
      list: list,
    };
  } catch (error) {
    throw new Error(`获取豆瓣列表数据失败: ${(error as Error).message}`);
  }
}

// 导出统一接口
export const getDoubanCategories = fetchDoubanCategories;
export const getDoubanList = fetchDoubanList;
export function shouldUseDoubanClient(): boolean { return true; }
