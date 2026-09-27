import { Info, ProviderContext } from "../types";
import { katworldGetMeta } from "../extractors/katworld";

export const getMeta = async function ({
  link,
  providerContext,
}: {
  link: string;
  providerContext: ProviderContext;
}): Promise<Info> {
  return katworldGetMeta({
    urlKey: "katmovie4k",
    providerName: "Katmovie4K",
    link,
    providerContext,
  });
};
