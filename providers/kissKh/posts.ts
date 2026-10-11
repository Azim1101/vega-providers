import { Post, ProviderContext } from "../types";
import { getBaseUrl } from "../getBaseUrl";

const DEFAULT_BASE_URL = "https://kisskh.is";

function normalizeBaseUrl(value: string): string {
  return (value || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

async function resolveBaseUrl(): Promise<string> {
  try {
    return normalizeBaseUrl(await getBaseUrl("kissKh"));
  } catch {
    return DEFAULT_BASE_URL;
  }
}

function getItems(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function toPost(element: any, baseUrl: string): Post | undefined {
  const id = element?.id;
  const title = typeof element?.title === "string" ? element.title.trim() : "";
  const image = element?.thumbnail || element?.image || element?.poster || "";
  if (!title || id === undefined || id === null || !image) return undefined;

  return {
    title,
    link: `${baseUrl}/api/DramaList/Drama/${encodeURIComponent(String(id))}?isq=false`,
    image,
  };
}

async function fetchPosts(
  url: string,
  signal: AbortSignal,
  providerContext: ProviderContext,
  baseUrl: string,
): Promise<Post[]> {
  const { axios } = providerContext;
  try {
    const response = await axios.get(url, { signal });
    return getItems(response.data)
      .map((element) => toPost(element, baseUrl))
      .filter((post): post is Post => Boolean(post));
  } catch (error) {
    if (!signal.aborted) {
      console.error("KissKh posts request failed", error);
    }
    return [];
  }
}

export const getPosts = async function ({
  filter,
  signal,
  providerContext,
}: {
  filter: string;
  page: number;
  providerValue: string;
  signal: AbortSignal;
  providerContext: ProviderContext;
}): Promise<Post[]> {
  const baseUrl = await resolveBaseUrl();
  const url = new URL(filter || "/api/DramaList/List?type=0&sub=0&country=0&status=0&order=2", `${baseUrl}/`).href;
  return fetchPosts(url, signal, providerContext, baseUrl);
};

export const getSearchPosts = async function ({
  searchQuery,
  signal,
  providerContext,
}: {
  searchQuery: string;
  page: number;
  providerValue: string;
  signal: AbortSignal;
  providerContext: ProviderContext;
}): Promise<Post[]> {
  const baseUrl = await resolveBaseUrl();
  const query = encodeURIComponent(searchQuery.trim());
  const url = `${baseUrl}/api/DramaList/Search?q=${query}&type=0`;
  return fetchPosts(url, signal, providerContext, baseUrl);
};
