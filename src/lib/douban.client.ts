import { DoubanItem, DoubanResult } from './types';

// 你的 EdgeOne 边缘函数地址
const EDGE_PROXY_BASE = 'https://db.gullu.cc.cd';

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
 * 封装经过 EdgeOne 代理的请求
 * 修复了 URL 拼接逻辑，确保格式为：代理地址/?url=编码后的目标地址
 */
async function fetchWithEdgeProxy(targetUrl: string): Promise<Response> {
  const finalUrl = `${EDGE_PROXY_BASE}/?url=${encodeURIComponent(targetUrl)}`;

  const response = await fetch(finalUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json, text/plain, */*',
    },
  });

  if (!response.ok) {
    throw new Error(`边缘函数代理请求失败: ${response.status}`);
  }

  return response;
}

/**
 * 浏览器端豆瓣分类数据获取函数 (近期热门)
 */
export async function fetchDoubanCategories(
  params: DoubanCategoriesParams
): Promise<DoubanResult> {
  const { kind, category, type, pageLimit = 20, pageStart = 0 } = params;

  // 构造豆瓣移动端 H5 接口 URL
  const target = `https://m.douban.com/rexxar/api/v2/subject/recent_hot/${kind}?start=${pageStart}&limit=${pageLimit}&category=${encodeURIComponent(category)}&type=${encodeURIComponent(type)}`;

  try {
    const response = await fetchWithEdgeProxy(target);
    const doubanData: DoubanCategoryApiResponse = await response.json();

    const list: DoubanItem[] = (doubanData.items || []).map((item) => ({
      id: item.id,
      title: item.title,
      poster: item.pic?.normal || item.pic?.large || '',
      rate: item.rating?.value ? item.rating.value.toFixed(1) : '暂无',
      year: item.card_subtitle?.match(/(\d{4})/)?.[1] || '',
    }));

    return { code: 200, message: '获取成功', list };
  } catch (error) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('globalError', {
        detail: { message: '获取豆瓣分类数据失败，请检查 EdgeOne 代理' }
      }));
    }
    throw error;
  }
}

/**
 * 获取豆瓣列表数据 (标签搜索版)
 */
export async function fetchDoubanList(params: {
  tag: string;
  type: string;
  pageLimit?: number;
  pageStart?: number;
}): Promise<DoubanResult> {
  const { tag, type, pageLimit = 20, pageStart = 0 } = params;

  // 统一改用更稳定的 H5 汇总接口
  const target = `https://m.douban.com/rexxar/api/v2/subject_collection/filter_${type}_${encodeURIComponent(tag)}/items?start=${pageStart}&count=${pageLimit}`;

  try {
    const response = await fetchWithEdgeProxy(target);
    const data = await response.json();

    const list: DoubanItem[] = (data.items || []).map((item: any) => ({
      id: item.id,
      title: item.title,
      poster: item.pic?.normal || item.pic?.large || '',
      rate: item.rating?.value ? item.rating.value.toFixed(1) : '暂无',
      year: item.year || item.card_subtitle?.match(/(\d{4})/)?.[1] || '',
    }));

    return { code: 200, message: '获取成功', list };
  } catch (error) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('globalError', {
        detail: { message: '获取豆瓣列表数据失败' }
      }));
    }
    throw error;
  }
}

/**
 * 暴露给外部的统一接口
 */
export async function getDoubanCategories(params: DoubanCategoriesParams): Promise<DoubanResult> {
  return fetchDoubanCategories(params);
}

export async function getDoubanList(params: {
  tag: string;
  type: string;
  pageLimit?: number;
  pageStart?: number;
}): Promise<DoubanResult> {
  return fetchDoubanList(params);
}

export function shouldUseDoubanClient(): boolean {
  return true;
}
