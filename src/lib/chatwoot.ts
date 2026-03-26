interface ChatwootOutboundMessage {
  to: string;
  text: string;
  chatwootInboxId: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function parseChatwootOutbound(
  payload: any
): ChatwootOutboundMessage | null {
  // Chatwoot sends message_created event when agent replies
  if (payload.event !== "message_created") return null;

  // message_type 1 = outgoing (from agent)
  if (payload.message_type !== 1) return null;

  // Skip private notes
  if (payload.private) return null;

  const content = payload.content;
  if (!content) return null;

  // Extract phone number from conversation contact
  const phone =
    payload.conversation?.contact?.phone_number ||
    payload.conversation?.meta?.sender?.phone_number;

  if (!phone) return null;

  // Extract inbox ID to map back to WhatsApp account
  const inboxId = payload.inbox?.id?.toString();
  if (!inboxId) return null;

  // Clean phone number (remove + prefix, spaces, dashes)
  const cleanPhone = phone.replace(/[^\d]/g, "");

  return {
    to: cleanPhone,
    text: content,
    chatwootInboxId: inboxId,
  };
}
