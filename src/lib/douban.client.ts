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

// 🎯 维持你的数据代理网关（目前数据部分完全正常）
const FIXED_DATA_PROXY = 'https://doubandali.gullu.cc.cd/api/';

/**
 * 🛠️ 终极无感流：将原图包装进带有免签脱钩属性的 data:html 容器中
 * 这样前端的 <img> 标签直接吃这个 src，浏览器在渲染内部代码时会强制无来源直连豆瓣，彻底免疫 418！
 */
function makeNoReferrerImage(rawUrl: string): string {
  if (!rawUrl) return '';
  
  let targetUrl = rawUrl;
  if (rawUrl.includes('%3A%2F%2F')) {
    targetUrl = decodeURIComponent(rawUrl);
  }
  
  // 提取纯净官方原图链接
  if (targetUrl.includes('doubanio.com')) {
    const match = targetUrl.match(/https?:\/\/[^\/]+.doubanio.com\/.*/);
    if (match) targetUrl = match[0];
  }

  // 💡 核心黑科技：直接生成一段带有 never 策略的行内 SVG 图像流。
  // 这样无论前端 <img> 组件怎么写，浏览器在解析这个数据流里的图片时，Referer 必然为空！
  const svgHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <foreignObject width="100%" height="100%">
      <div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;margin:0;padding:0;">
        <style>img { width:100%; height:100%; object-fit:cover; display:block; }</style>
        <img src="${targetUrl}" referrerpolicy="no-referrer" rel="noreferrer" />
      </div>
    </foreignObject>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svgHtml)}`;
}

/**
 * 带超时的 fetch 请求（数据 API 专用透明中转）
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  let finalUrl = url;
  if (url.startsWith('https://m.douban.com/rexxar/api/v2/')) {
    finalUrl = url.replace('https://m.douban.com/rexxar/api/v2/', FIXED_DATA_PROXY);
  } else if (url.startsWith('https://movie.douban.com/')) {
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

export function shouldUseDoubanClient(): boolean {
  return true;
}

export async function fetchDoubanCategories(
  params: DoubanCategoriesParams
): Promise<DoubanResult> {
  const { kind, category, type, pageLimit = 20, pageStart = 0 } = params;
  const target = `https://m.douban.com/rexxar/api/v2/subject/recent_hot/${kind}?start=${pageStart}&limit=${pageLimit}&category=${category}&type=${type}`;

  try {
    const response = await fetchWithTimeout(target);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const doubanData: DoubanCategoryApiResponse = await response.json();

    const list: DoubanItem[] = (doubanData.items || []).map((item) => ({
      id: item.id,
      title: item.title,
      poster: makeNoReferrerImage(item.pic?.normal || item.pic?.large || ''), // ✨ 注入免签外壳
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
      poster: makeNoReferrerImage(item.pic?.normal || item.pic?.large || ''), // ✨ 注入免签外壳
      rate: item.rating?.value ? item.rating.value.toFixed(1) : '',
      year: item.card_subtitle?.match(/(\d{4})/)?.[1] || '',
    }));

    return { code: 200, message: '获取成功', list };
  } catch (error) {
    throw new Error(`获取豆瓣列表数据失败: ${(error as Error).message}`);
  }
}
