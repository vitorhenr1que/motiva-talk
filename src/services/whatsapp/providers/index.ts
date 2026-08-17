import type { WhatsAppProvider } from "./whatsapp-provider";
import { metaCloudProvider } from "./meta-cloud-provider";
import type { WhatsAppProviderType } from "@/types/chat";

type ProviderLikeChannel = {
  whatsappProvider?: WhatsAppProviderType | null;
  metaPhoneNumberId?: string | null;
  metaAccessToken?: string | null;
};

export function resolveWhatsAppProviderType(
  channel?: ProviderLikeChannel | null
): WhatsAppProviderType {
  return 'META_CLOUD';
}

export function getWhatsAppProvider(_type?: WhatsAppProviderType | null): WhatsAppProvider {
  return metaCloudProvider;
}

export type { WhatsAppProvider };
export { metaCloudProvider };
