import { DoubanItem, DoubanResult } from './types';

/**
 * EdgeOne 边缘函数代理地址
 * 已部署在：https://douban-proxy-zone-3kq9qzv6e0jf-1393829787.eo-edgefunctions1.com
 */
const EDGE_PROXY_URL = 'https://douban-proxy-zone-3kq9qzv6e0jf-1393829787.eo-edgefunctions1.com';

/**
 * 封装经过边缘函数代理的 fetch 请求
 * 自动处理 URL 编码并转发至 EdgeOne
 */
async function fetchViaProxy(doubanUrl: string): Promise<Response> {
  // 将目标豆瓣 API 地址作为参数传给你的 EdgeOne 函数
  const finalUrl = `${EDGE_PROXY_URL}/?url=${encodeURIComponent(doubanUrl)}`;

  const response = await fetch(finalUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    }
  });

  if (!response.ok) {
    throw new Error(`代理请求失败: ${response.status} ${response.statusText}`);
  }

  return response;
}

/**
 * 获取豆瓣列表数据（使用移动端 H5 接口，最稳定）
 * @param kind 'movie' 或 'tv'
 * @param tag 类别标签（如 'hot', 'top250', 'action'）
 */
export async function getDoubanList(
  kind: 'movie' | 'tv',
  tag: string,
  limit = 20,
  start = 0
): Promise<DoubanResult> {
  // 构造豆瓣移动端 H5 接口 URL
  const target = `https://m.douban.com/rexxar/api/v2/subject_collection/filter_${kind}_${encodeURIComponent(tag)}/items?start=${start}&count=${limit}`;

  try {
    const response = await fetchViaProxy(target);
    const data = await response.json();

    // 适配移动端 H5 接口的 items 数据结构
    const list: DoubanItem[] = (data.items || []).map((item: any) => ({
      id: item.id,
      title: item.title,
      // 移动端接口图片字段为 pic.normal
      poster: item.pic?.normal || item.pic?.large || '',
      rate: item.rating?.value ? item.rating.value.toFixed(1) : '暂无评分',
      // 从副标题中提取年份，如 "2024 / 美国 / 剧情"
      year: item.year || item.card_subtitle?.match(/(\d{4})/)?.[1] || '',
    }));

    return {
      code: 200,
      message: '获取成功',
      list: list,
    };
  } catch (error) {
    // 触发全局错误提示逻辑
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('globalError', {
          detail: { message: `获取豆瓣数据失败: ${(error as Error).message}` },
        })
      );
    }
    throw error;
  }
}

/**
 * 兼容原有的分类获取函数
 */
export async function getDoubanCategories(params: {
  kind: 'tv' | 'movie';
  category: string;
  type: string;
  pageLimit?: number;
  pageStart?: number;
}): Promise<DoubanResult> {
  const { kind, category, pageLimit = 20, pageStart = 0 } = params;
  // 调用封装好的 H5 获取逻辑
  return getDoubanList(kind, category, pageLimit, pageStart);
}
