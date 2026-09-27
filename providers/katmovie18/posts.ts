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
    urlKey: "katmovie18",
    providerName: "Katmovie18",
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
    urlKey: "katmovie18",
    providerName: "Katmovie18",
    searchQuery,
    page,
    signal,
    providerContext,
  });
};
