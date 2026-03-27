const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";

interface SendMessagePayload {
  messaging_product: "whatsapp";
  to: string;
  type: string;
  [key: string]: unknown;
}

interface MetaResponse {
  messaging_product: string;
  contacts?: { input: string; wa_id: string }[];
  messages?: { id: string }[];
  error?: { message: string; type: string; code: number };
}

export async function sendMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  message: { type: string; [key: string]: unknown }
): Promise<MetaResponse> {
  const payload: SendMessagePayload = {
    messaging_product: "whatsapp",
    to,
    ...message,
  };

  const res = await fetch(
    `${GRAPH_API_BASE}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  return res.json();
}

export async function sendTextMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  text: string
): Promise<MetaResponse> {
  return sendMessage(phoneNumberId, accessToken, to, {
    type: "text",
    text: { body: text },
  });
}

export async function getMediaUrl(
  mediaId: string,
  accessToken: string
): Promise<string> {
  const res = await fetch(`${GRAPH_API_BASE}/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await res.json();
  if (!data.url) throw new Error(`No URL returned for media ${mediaId}`);
  return data.url;
}

export async function downloadMedia(
  mediaId: string,
  accessToken: string
): Promise<{ buffer: Buffer; contentType: string }> {
  const url = await getMediaUrl(mediaId, accessToken);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to download media: ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "application/octet-stream";
  const arrayBuffer = await res.arrayBuffer();

  return {
    buffer: Buffer.from(arrayBuffer),
    contentType,
  };
}
