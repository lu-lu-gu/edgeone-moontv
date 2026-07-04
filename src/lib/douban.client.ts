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

// 🎯 写死固定你的腾讯云 EdgeOne 独家数据反代网关
const FIXED_DATA_PROXY = 'https://doubandali.gullu.cc.cd/api/';

// 🎯 写死固定经过 H5 实战测试最稳的免签海报反代源（绕过 418）
const FIXED_IMAGE_PROXY = 'https://images.weserv.nl/?url=';

/**
 * 辅助工具函数：在前端自动化将豆瓣原图替换为免签公共反代地址
 */
function cleanAndProxyImage(rawUrl: string): string {
  if (!rawUrl) return '';
  // 智能清洗，如果已经是完整的 url，直接将其追加到免签反代后面
  return `${FIXED_IMAGE_PROXY}${encodeURIComponent(rawUrl)}`;
}

/**
 * 带超时的 fetch 请求（已将请求彻底重定向至腾讯云 EdgeOne 专用通道）
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

  // 🚀 核心逻辑更改：放弃读取 utils 的配置，强制把原豆瓣链接转换为你的云反代透明路径
  let finalUrl = url;
  if (url.startsWith('https://m.douban.com/rexxar/api/v2/')) {
    // 转换示例：https://m.douban.com/rexxar/api/v2/subject/... -> https://doubandali.gullu.cc.cd/api/v2/subject/...
    finalUrl = url.replace('https://m.douban.com/rexxar/api/v2/', FIXED_DATA_PROXY);
  } else if (url.startsWith('https://movie.douban.com/')) {
    // 兼容可能出现的其它旧版 API 分流
    finalUrl = url.replace('https://movie.douban.com/', FIXED_DATA_PROXY);
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

/**
 * 检查是否应该使用客户端获取豆瓣数据
 */
export function shouldUseDoubanClient(): boolean {
  return true;
}

/**
 * 浏览器端豆瓣分类数据获取函数
 */
export async function fetchDoubanCategories(
  params: DoubanCategoriesParams
): Promise<DoubanResult> {
  const { kind, category, type, pageLimit = 20, pageStart = 0 } = params;

  if (!['tv', 'movie'].includes(kind)) {
    throw new Error('kind 参数必须是 tv 或 movie');
  }
  if (!category || !type) {
    throw new Error('category 和 type 参数不能为空');
  }
  if (pageLimit < 1 || pageLimit > 100) {
    throw new Error('pageLimit 必须在 1-100 之间');
  }
  if (pageStart < 0) {
    throw new Error('pageStart 不能小于 0');
  }

  const target = `https://m.douban.com/rexxar/api/v2/subject/recent_hot/${kind}?start=${pageStart}&limit=${pageLimit}&category=${category}&type=${type}`;

  try {
    const response = await fetchWithTimeout(target);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const doubanData: DoubanCategoryApiResponse = await response.json();

    // 🚀 核心修改：在数据下发的一瞬间，用 cleanAndProxyImage 把海报处理成免签防反代地址
    const list: DoubanItem[] = (doubanData.items || []).map((item) => ({
      id: item.id,
      title: item.title,
      poster: cleanAndProxyImage(item.pic?.normal || item.pic?.large || ''),
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

/**
 * 统一的豆瓣分类数据获取函数
 */
export async function getDoubanCategories(
  params: DoubanCategoriesParams
): Promise<DoubanResult> {
  return fetchDoubanCategories(params);
}

interface DoubanListParams {
  tag: string;
  type: string;
  pageLimit?: number;
  pageStart?: number;
}

export async function getDoubanList(
  params: DoubanListParams
): Promise<DoubanResult> {
  return fetchDoubanList(params);
}

export async function fetchDoubanList(
  params: DoubanListParams
): Promise<DoubanResult> {
  const { tag, type, pageLimit = 20, pageStart = 0 } = params;

  if (!tag || !type) {
    throw new Error('tag 和 type 参数不能为空');
  }
  if (!['tv', 'movie'].includes(type)) {
    throw new Error('type 参数必须是 tv 或 movie');
  }
  if (pageLimit < 1 || pageLimit > 100) {
    throw new Error('pageLimit 必须在 1-100 之间');
  }
  if (pageStart < 0) {
    throw new Error('pageStart 不能小于 0');
  }

  const target = `https://movie.douban.com/j/search_subjects?type=${type}&tag=${tag}&sort=recommend&page_limit=${pageLimit}&page_start=${pageStart}`;

  try {
    const response = await fetchWithTimeout(target);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const doubanData: DoubanCategoryApiResponse = await response.json();

    // 🚀 核心修改：同理，列表里的海报也在前端吐出时直接洗成免签反代
    const list: DoubanItem[] = (doubanData.items || []).map((item) => ({
      id: item.id,
      title: item.title,
      poster: cleanAndProxyImage(item.pic?.normal || item.pic?.large || ''),
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
          detail: { message: '获取豆瓣列表数据失败' },
        })
      );
    }
    throw new Error(`获取豆瓣分类数据失败: ${(error as Error).message}`);
  }
}
