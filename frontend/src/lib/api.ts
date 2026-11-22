const receiptService = "/odata/v4/receipt";
const publicService = "/odata/v4/public-receipt";
const directoryService = "/odata/v4/directory";

type ODataCollection<T> = { value: T[] };

export interface ReceiptExtraction {
  receiptInfo: {
    merchantName: string;
    currency: string;
    taxAmount: number | null;
    taxPercentage: number | null;
    discountAmount: number | null;
    priceAmount: number | null;
    roundingAdjustment: number | null;
    pricesIncludeTax: boolean;
  };
  items: {
    description: string;
    quantity: number | null;
    priceTaxInclusive: number | null;
    itemSpecificDiscount: number | null;
  }[];
}

const csrfTokens = new Map<string, string>();

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function getCsrfToken(service: string): Promise<string | null> {
  const cachedToken = csrfTokens.get(service);
  if (cachedToken) return cachedToken;

  const response = await fetch(`${service}/$metadata`, {
    credentials: "same-origin",
    headers: { "X-CSRF-Token": "Fetch" },
  });
  if (!response.ok) {
    throw new ApiError(
      `Unable to prepare a secure write (${response.status}).`,
      response.status,
    );
  }
  const token = response.headers.get("X-CSRF-Token");
  if (token) csrfTokens.set(service, token);
  return token;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method?.toUpperCase() ?? "GET";
  let writeHeaders: Record<string, string> = {};
  if (method !== "GET" && method !== "HEAD") {
    const service = path.startsWith(publicService)
      ? publicService
      : receiptService;
    const token = await getCsrfToken(service);
    if (token) writeHeaders = { "X-CSRF-Token": token };
  }
  const response = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...writeHeaders,
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(
      body?.error?.message || body?.message || `Request failed (${response.status})`,
      response.status,
    );
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function readCollection<T>(path: string): Promise<T[]> {
  const result = await request<ODataCollection<T>>(path);
  return result.value;
}

export function read<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function create<T>(path: string, value: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: JSON.stringify(value),
  });
}

export function update(path: string, value: unknown): Promise<void> {
  return request<void>(path, {
    method: "PATCH",
    body: JSON.stringify(value),
  });
}

export function remove(path: string): Promise<void> {
  return request<void>(path, { method: "DELETE" });
}

export function receiptKey(id: string): string {
  return `${receiptService}/Receipts(${encodeURIComponent(id)})`;
}

export async function getReceiptImage(id: string): Promise<string | null> {
  const result = await read<{ value: string | null }>(
    `${receiptService}/receiptImage(ID=${encodeURIComponent(id)})`,
  );
  return imageDataUrl(result.value);
}

export function paymentMethodKey(id: string): string {
  return `${receiptService}/PaymentMethods(${encodeURIComponent(id)})`;
}

export function receiptItemKey(id: string): string {
  return `${receiptService}/ReceiptItems(${encodeURIComponent(id)})`;
}

export function webhookKey(id: string): string {
  return `${receiptService}/Webhooks(${encodeURIComponent(id)})`;
}

export interface WebhookTestResult {
  ok: boolean;
  status: number;
  message: string;
}

export function testWebhook(id: string): Promise<WebhookTestResult> {
  return request(`${receiptService}/testWebhook`, {
    method: "POST",
    body: JSON.stringify({ ID: id }),
  });
}

export function profileKey(id: string): string {
  const literal = `'${id.replaceAll("'", "''")}'`;
  return `${receiptService}/Profiles(${encodeURIComponent(literal)})`;
}

export function getMyProfile<T>(id: string): Promise<T> {
  return read<T>(profileKey(id));
}

export async function saveMyProfile(
  id: string,
  value: { displayName?: string; paymentQrData?: string | null },
): Promise<void> {
  try {
    await getMyProfile(id);
    await update(profileKey(id), value);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) {
      throw error;
    }
    await create(`${receiptService}/Profiles`, { ID: id, ...value });
  }
}

export async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize),
    );
  }

  return btoa(binary);
}

export function extractReceipt(
  imageData: string,
  contentType: string,
): Promise<ReceiptExtraction> {
  return request(`${receiptService}/extractReceipt`, {
    method: "POST",
    body: JSON.stringify({ imageData, contentType }),
  });
}

export function imageDataUrl(data: string | null | undefined): string | null {
  if (!data) return null;
  if (data.startsWith("data:")) return data;
  return `data:image/jpeg;base64,${data}`;
}

export async function getSharedReceipt<T>(id: string): Promise<T> {
  return read<T>(
    `${publicService}/getReceipt(ID=${encodeURIComponent(id)})`,
  );
}

export function markSharedItemsPaid(
  id: string,
  itemIDs: string[],
  paidByName: string,
  quantities?: Record<string, number>,
): Promise<boolean> {
  return request<boolean>(`${publicService}/markAsPaid`, {
    method: "POST",
    body: JSON.stringify({
      ID: id,
      itemIDs: JSON.stringify(itemIDs),
      paidByName,
      quantities: quantities ? JSON.stringify(quantities) : undefined,
    }),
  });
}

export const services = {
  receipt: receiptService,
  directory: directoryService,
};
