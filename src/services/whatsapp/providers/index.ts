import type { WhatsAppProvider } from "./whatsapp-provider";
import { evolutionProvider } from "./evolution-provider";
import { metaCloudProvider } from "./meta-cloud-provider";
import { WhatsAppProviderType } from "@/types/chat";

export function getWhatsAppProvider(type?: WhatsAppProviderType): WhatsAppProvider {
  if (type === 'META_CLOUD') {
    return metaCloudProvider;
  }
  // Default to EVOLUTION for backward compatibility
  return evolutionProvider;
}

export type { WhatsAppProvider };
export { evolutionProvider, metaCloudProvider };
