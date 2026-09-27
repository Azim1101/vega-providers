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
    urlKey: "moviesBaba",
    providerName: "MoviesBaba",
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
    urlKey: "moviesBaba",
    providerName: "MoviesBaba",
    searchQuery,
    page,
    signal,
    providerContext,
  });
};
