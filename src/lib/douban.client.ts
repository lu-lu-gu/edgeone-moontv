// ... 前面部分保持不变 ...

const PROXY_BASE = 'https://db.gullu.cc.cd/api';

/**
 * 修正后的请求函数
 */
async function fetchFromProxy(path: string): Promise<Response> {
  // 确保 path 是以 / 开头，且不重复包含 /api
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const finalUrl = `${PROXY_BASE}${cleanPath}`;
  
  return await fetch(finalUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Cache-Control': 'no-cache'
    }
  });
}

/**
 * 适配 Rexxar 接口的数据结构
 */
export async function fetchDoubanCategories(
  params: DoubanCategoriesParams
): Promise<DoubanResult> {
  const { kind, category, type, pageLimit = 18, pageStart = 0 } = params;

  // Rexxar 接口通常需要 apikey，如果边缘函数没处理，这里得补上
  // 这里先尝试不带 apikey 的标准路径
  const path = `/rexxar/api/v2/subject/recent_hot/${kind}?start=${pageStart}&count=${pageLimit}&category=${category}&type=${type}`;

  try {
    const response = await fetchFromProxy(path);
    
    // 如果返回的不是 JSON，打印出来看具体错误
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error("代理返回了非 JSON 内容:", text.substring(0, 100));
      throw new Error("接口返回格式错误，请检查边缘函数路由");
    }

    const data = await response.json();
    // 兼容多种返回结构
    const rawList = data.subject_collection_items || data.items || data.subjects || [];

    const list: DoubanItem[] = rawList.map((item: any) => ({
      id: item.id,
      title: item.title,
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
