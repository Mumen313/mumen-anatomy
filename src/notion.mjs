// Minimal Notion API client (no dependencies). Node 20+.
const API = 'https://api.notion.com/v1';
const VERSION = '2022-06-28';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createNotionClient(token) {
  if (!token) throw new Error('NOTION_TOKEN is missing. Add it as a GitHub secret (see README).');

  async function call(method, path, body, attempt = 0) {
    const res = await fetch(API + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': VERSION,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429 || res.status >= 500) {
      if (attempt > 5) throw new Error(`Notion ${res.status} on ${path}`);
      const wait = Number(res.headers.get('retry-after') || 1) * 1000 * (attempt + 1);
      await sleep(wait);
      return call(method, path, body, attempt + 1);
    }
    const data = await res.json();
    if (!res.ok) throw new Error(`Notion ${res.status} on ${path}: ${data.message || JSON.stringify(data)}`);
    await sleep(120); // stay under ~3 requests/second
    return data;
  }

  async function paginate(fn) {
    const out = [];
    let cursor;
    do {
      const page = await fn(cursor);
      out.push(...page.results);
      cursor = page.has_more ? page.next_cursor : undefined;
    } while (cursor);
    return out;
  }

  return {
    page: (id) => call('GET', `/pages/${id}`),
    children: (id) =>
      paginate((c) => call('GET', `/blocks/${id}/children?page_size=100${c ? `&start_cursor=${c}` : ''}`)),
    queryDatabase: (id, body = {}) =>
      paginate((c) => call('POST', `/databases/${id}/query`, { ...body, page_size: 100, ...(c ? { start_cursor: c } : {}) })),
  };
}

// Loads a block tree: every block gets `.children` if it has any.
export async function loadBlocks(client, id) {
  const blocks = await client.children(id);
  for (const b of blocks) {
    if (b.has_children && b.type !== 'child_page' && b.type !== 'child_database') {
      b.children = await loadBlocks(client, b.id);
    }
  }
  return blocks;
}

// Property helpers
export const prop = {
  text: (p) => (p?.title || p?.rich_text || []).map((t) => t.plain_text).join('').trim(),
  select: (p) => p?.select?.name || '',
  number: (p) => (typeof p?.number === 'number' ? p.number : null),
  date: (p) => p?.date?.start || '',
};
