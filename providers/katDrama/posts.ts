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
    urlKey: "katDrama",
    providerName: "KatDrama",
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
    urlKey: "katDrama",
    providerName: "KatDrama",
    searchQuery,
    page,
    signal,
    providerContext,
  });
};
