import { Post, ProviderContext } from "../types";
import { katworldGetPosts, katworldSearchPosts } from "../extractors/katworld";

export const getPosts = async function ({
  filter,
  page,
  signal,
  providerContext,
}: {
  filter: string;
  page: number;
  providerValue: string;
  signal: AbortSignal;
  providerContext: ProviderContext;
}): Promise<Post[]> {
  return katworldGetPosts({
    urlKey: "pikaHD",
    providerName: "PikaHD",
    filter,
    page,
    signal,
    providerContext,
  });
};

export const getSearchPosts = async function ({
  searchQuery,
  page,
  signal,
  providerContext,
}: {
  searchQuery: string;
  page: number;
  providerValue: string;
  signal: AbortSignal;
  providerContext: ProviderContext;
}): Promise<Post[]> {
  return katworldSearchPosts({
    urlKey: "pikaHD",
    providerName: "PikaHD",
    searchQuery,
    page,
    signal,
    providerContext,
  });
};
