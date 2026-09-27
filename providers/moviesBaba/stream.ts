import { Stream, ProviderContext } from "../types";
import { katworldGetStream } from "../extractors/katworld";

export const getStream = async function ({
  link,
  type,
  signal,
  providerContext,
}: {
  link: string;
  type: string;
  signal: AbortSignal;
  providerContext: ProviderContext;
}): Promise<Stream[]> {
  return katworldGetStream({
    providerName: "MoviesBaba",
    link,
    signal,
    providerContext,
  });
};
