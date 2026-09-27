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
    urlKey: "pikaHD",
    providerName: "PikaHD",
    link,
    providerContext,
  });
};
