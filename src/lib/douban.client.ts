import { DoubanItem, DoubanResult } from './types';

interface DoubanCategoriesParams {
  kind: 'tv' | 'movie';
  category: string;
  type: string;
  pageLimit?: number;
  pageStart?: number;
}

interface DoubanCategoryApiResponse {
  subjects?: any[];
  subject_collection_items?: any[];
  items?: any[];
}

/**
 * 核心配置：使用你自己的生产代理地址
 */
const PROXY_BASE = 'https://db.gullu.cc.cd/api';

/**
 * 辅助函数：将豆瓣原始图片 URL 转换为代理 URL，解决 418 错误
 */
function getProxyImageUrl(originalUrl: string): string {
  if (!originalUrl) return '';
  // 转换格式示例: https://db.gullu.cc.cd/api/img/img9.doubanio.com/...
  return `${PROXY_BASE}/img/${originalUrl.replace(/^https?:\/\//, '')}`;
}

/**
 * 通用请求函数
 */
async function fetchFromProxy(path: string): Promise<Response> {
  // 拼接完整的代理请求地址
  const finalUrl = `${PROXY_BASE}${path}`;
  
  return await fetch(finalUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    }
  });
}

export async function fetchDoubanCategories(
  params: DoubanCategoriesParams
): Promise<DoubanResult> {
  const { kind, category, type, pageLimit = 18, pageStart = 0 } = params;

  // 使用 Rexxar 接口路径
  const path = `/rexxar/api/v2/subject/recent_hot/${kind}?start=${pageStart}&count=${pageLimit}&category=${category}&type=${type}`;

  try {
    const response = await fetchFromProxy(path);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data: DoubanCategoryApiResponse = await response.json();
    
    // 兼容多种返回字段
    const rawList = data.subject_collection_items || data.items || data.subjects || [];

    const list: DoubanItem[] = rawList.map((item: any) => ({
      id: item.id,
      title: item.title,
      // 使用图片代理解决 418 问题
      poster: getProxyImageUrl(item.cover?.url || item.pic?.normal || item.cover || ''),
      rate: item.rating?.value ? item.rating.value.toFixed(1) : (item.rate || ''),
      year: item.year || item.card_subtitle?.match(/(\d{4})/)?.[1] || '',
    }));

    return { code: 200, message: '获取成功', list };
  } catch (error) {
    console.error('获取豆瓣分类失败:', error);
    throw error;
  }
}

interface DoubanListParams {
  tag: string;
  type: string;
  pageLimit?: number;
  pageStart?: number;
}

/**
 * 获取搜索/标签列表 (PC 网页版接口转发)
 */
export async function fetchDoubanList(
  params: DoubanListParams
): Promise<DoubanResult> {
  const { tag, type, pageLimit = 18, pageStart = 0 } = params;

  // 使用 PC 网页版搜索接口路径
  const path = `/j/search_subjects?type=${type}&tag=${encodeURIComponent(tag)}&page_limit=${pageLimit}&page_start=${pageStart}`;

  try {
    const response = await fetchFromProxy(path);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data: DoubanCategoryApiResponse = await response.json();
    const rawList = data.subjects || [];

    const list: DoubanItem[] = rawList.map((item: any) => ({
      id: item.id,
      title: item.title,
      // 同样通过代理加载图片
      poster: getProxyImageUrl(item.cover || ''),
      rate: item.rate || '',
      year: '',
    }));

    return { code: 200, message: '获取成功', list };
  } catch (error) {
    console.error('获取豆瓣列表失败:', error);
    throw error;
  }
}

// 导出统一调用接口
export const getDoubanCategories = fetchDoubanCategories;
export const getDoubanList = fetchDoubanList;
export const shouldUseDoubanClient = () => true;
