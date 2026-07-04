import { DoubanItem, DoubanResult } from './types';

// ==================== 配置区 ====================
// 修正后的数据与图片代理基础域（移除旧版的代理地址拼凑）
const EDGE_API_BASE = 'https://doubandali.gullu.cc.cd/api';
const EDGE_IMG_BASE = 'https://doubandali.gullu.cc.cd/img/';
// ===============================================

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
 * 封装经过 EdgeOne 路径透明代理的请求
 * 格式转换：https://m.douban.com/rexxar/api/... -> ${EDGE_API_BASE}/rexxar/api/...
 */
async function fetchWithEdgeProxy(targetUrl: string): Promise<Response> {
  // 将原豆瓣移动端主域名，直接替换成我们的 EdgeOne 数据代理前缀
  const finalUrl = targetUrl.replace('https://m.douban.com/rexxar/api', EDGE_API_BASE);

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
 * 助手函数：将豆瓣原始图片 URL 转换为走 EdgeOne 30天强缓存的代理 URL
 * 兼容系统拼接，进行完整的 UrlEncode 编码
 */
function proxyPosterUrl(originalUrl: string): string {
  if (!originalUrl) return '';
  // 转换为：https://doubandali.gullu.cc.cd/img/https%3A%2F%2Fimg9.doubanio.com%2F...
  return `${EDGE_IMG_BASE}${encodeURIComponent(originalUrl)}`;
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

    const list: DoubanItem[] = (doubanData.items || []).map((item) => {
      const originalPoster = item.pic?.normal || item.pic?.large || '';
      return {
        id: item.id,
        title: item.title,
        poster: proxyPosterUrl(originalPoster), // 拦截并启用 EdgeOne 图片代理
        rate: item.rating?.value ? item.rating.value.toFixed(1) : '暂无',
        year: item.card_subtitle?.match(/(\d{4})/)?.[1] || '',
      };
    });

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

    const list: DoubanItem[] = (data.items || []).map((item: any) => {
      const originalPoster = item.pic?.normal || item.pic?.large || '';
      return {
        id: item.id,
        title: item.title,
        poster: proxyPosterUrl(originalPoster), // 拦截并启用 EdgeOne 图片代理
        rate: item.rating?.value ? item.rating.value.toFixed(1) : '暂无',
        year: item.year || item.card_subtitle?.match(/(\d{4})/)?.[1] || '',
      };
    });

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
