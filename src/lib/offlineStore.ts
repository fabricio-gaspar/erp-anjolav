import type { DehydratedState } from "@tanstack/react-query";
import type { PdvSaleResult } from "@/lib/pdvPayment";
import type { PdvSaleRequest } from "@/lib/pdvSale";
import { OFFLINE_CACHE_SCHEMA_VERSION } from "@/lib/offlinePolicy";

const DB_NAME = "anjolav-offline-v1";
const DB_VERSION = 1;
const RECORD_STORE = "records";
const KEY_STORE = "keys";

interface EncryptedPayload {
  version: number;
  iv: string;
  ciphertext: string;
}

interface StoredCryptoKey {
  id: string;
  key: CryptoKey;
}

interface EncryptedRecord {
  id: string;
  kind: "auth" | "query-cache" | "pdv-outbox";
  userId: string;
  tenantId: string | null;
  area: "industrial" | "residencial" | null;
  status: OfflinePdvQueueStatus | null;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  lastError: string | null;
  payload: EncryptedPayload;
}

export interface OfflineAuthSnapshot<TEmployee = unknown, TTenant = unknown, TSecurity = unknown> {
  userId: string;
  funcionario: TEmployee;
  tenantContext: TTenant;
  security: TSecurity;
  cachedAt: string;
}

export interface OfflinePdvReceiptItem {
  productId: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  subtotal: number;
  details?: string | null;
}

export interface OfflinePdvReceipt {
  localReference: string;
  createdAt: string;
  tenantName: string;
  area: "industrial" | "residencial";
  operatorName: string;
  clientId: string;
  clientName: string;
  clientDocument?: string | null;
  deliveryDate: string;
  receiptMode: "balcao" | "coleta";
  deliveryMode: "balcao" | "entrega";
  notes?: string | null;
  subtotal: number;
  discountAmount: number;
  urgencyAmount: number;
  deliveryFee: number;
  total: number;
  items: OfflinePdvReceiptItem[];
}

export type OfflinePdvQueueStatus = "pending" | "syncing" | "review" | "synced";

interface OfflinePdvQueuePayload {
  request: PdvSaleRequest;
  receipt: OfflinePdvReceipt;
  result?: PdvSaleResult;
  syncedAt?: string;
}

export interface OfflinePdvQueueItem {
  id: string;
  userId: string;
  tenantId: string;
  area: "industrial" | "residencial";
  status: OfflinePdvQueueStatus;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  lastError: string | null;
  request: PdvSaleRequest;
  receipt: OfflinePdvReceipt;
  result?: PdvSaleResult;
  syncedAt?: string;
}

let databasePromise: Promise<IDBDatabase> | null = null;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Falha no armazenamento offline"));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Falha no armazenamento offline"));
    transaction.onabort = () => reject(transaction.error ?? new Error("Operação offline cancelada"));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("Este navegador não oferece armazenamento offline seguro"));
  }

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(RECORD_STORE)) {
        const records = database.createObjectStore(RECORD_STORE, { keyPath: "id" });
        records.createIndex("by-user", "userId", { unique: false });
        records.createIndex("by-kind", "kind", { unique: false });
      }
      if (!database.objectStoreNames.contains(KEY_STORE)) {
        database.createObjectStore(KEY_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Não foi possível iniciar o armazenamento offline"));
    request.onblocked = () => reject(new Error("Feche outras abas antigas do AnjoLav para atualizar o modo offline"));
  });

  return databasePromise;
}

async function getRecord(id: string): Promise<EncryptedRecord | null> {
  const database = await openDatabase();
  const transaction = database.transaction(RECORD_STORE, "readonly");
  const done = transactionDone(transaction);
  const result = await requestResult(transaction.objectStore(RECORD_STORE).get(id));
  await done;
  return (result as EncryptedRecord | undefined) ?? null;
}

async function putRecord(record: EncryptedRecord): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(RECORD_STORE, "readwrite");
  transaction.objectStore(RECORD_STORE).put(record);
  await transactionDone(transaction);
}

async function deleteRecord(id: string): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(RECORD_STORE, "readwrite");
  transaction.objectStore(RECORD_STORE).delete(id);
  await transactionDone(transaction);
}

async function listRecordsForUser(userId: string): Promise<EncryptedRecord[]> {
  const database = await openDatabase();
  const transaction = database.transaction(RECORD_STORE, "readonly");
  const done = transactionDone(transaction);
  const index = transaction.objectStore(RECORD_STORE).index("by-user");
  const result = await requestResult(index.getAll(IDBKeyRange.only(userId)));
  await done;
  return result as EncryptedRecord[];
}

async function getOrCreateKey(userId: string): Promise<CryptoKey> {
  const database = await openDatabase();
  const keyId = `user:${userId}`;
  const readTransaction = database.transaction(KEY_STORE, "readonly");
  const readDone = transactionDone(readTransaction);
  const existing = await requestResult(readTransaction.objectStore(KEY_STORE).get(keyId));
  await readDone;
  if ((existing as StoredCryptoKey | undefined)?.key) return (existing as StoredCryptoKey).key;

  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  const writeTransaction = database.transaction(KEY_STORE, "readwrite");
  writeTransaction.objectStore(KEY_STORE).put({ id: keyId, key } satisfies StoredCryptoKey);
  await transactionDone(writeTransaction);
  return key;
}

function bytesToBase64(value: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < value.length; index += chunkSize) {
    binary += String.fromCharCode(...value.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function encryptValue(userId: string, value: unknown): Promise<EncryptedPayload> {
  const key = await getOrCreateKey(userId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cleartext = new TextEncoder().encode(JSON.stringify(value));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, cleartext);
  return {
    version: OFFLINE_CACHE_SCHEMA_VERSION,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
  };
}

async function decryptValue<T>(userId: string, payload: EncryptedPayload): Promise<T> {
  if (payload.version !== OFFLINE_CACHE_SCHEMA_VERSION) {
    throw new Error("Os dados offline pertencem a uma versão anterior do sistema");
  }
  const key = await getOrCreateKey(userId);
  const cleartext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(payload.iv) },
    key,
    base64ToBytes(payload.ciphertext),
  );
  return JSON.parse(new TextDecoder().decode(cleartext)) as T;
}

async function saveSingleton(
  kind: "auth" | "query-cache",
  userId: string,
  value: unknown,
): Promise<void> {
  const now = new Date().toISOString();
  const id = `${kind}:${userId}`;
  const existing = await getRecord(id);
  await putRecord({
    id,
    kind,
    userId,
    tenantId: null,
    area: null,
    status: null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    attempts: 0,
    lastError: null,
    payload: await encryptValue(userId, value),
  });
}

async function loadSingleton<T>(kind: "auth" | "query-cache", userId: string): Promise<{ value: T; updatedAt: string } | null> {
  const record = await getRecord(`${kind}:${userId}`);
  if (!record || record.kind !== kind || record.userId !== userId) return null;
  return { value: await decryptValue<T>(userId, record.payload), updatedAt: record.updatedAt };
}

export async function saveOfflineQueryCache(userId: string, state: DehydratedState): Promise<void> {
  await saveSingleton("query-cache", userId, state);
}

export function loadOfflineQueryCache(userId: string) {
  return loadSingleton<DehydratedState>("query-cache", userId);
}

export async function saveOfflineAuthSnapshot(snapshot: OfflineAuthSnapshot): Promise<void> {
  await saveSingleton("auth", snapshot.userId, snapshot);
}

export async function loadOfflineAuthSnapshot<TEmployee = unknown, TTenant = unknown, TSecurity = unknown>(
  userId: string,
): Promise<OfflineAuthSnapshot<TEmployee, TTenant, TSecurity> | null> {
  const stored = await loadSingleton<OfflineAuthSnapshot<TEmployee, TTenant, TSecurity>>("auth", userId);
  return stored?.value ?? null;
}

export async function clearOfflineSessionCache(userId: string): Promise<void> {
  await Promise.all([
    deleteRecord(`auth:${userId}`),
    deleteRecord(`query-cache:${userId}`),
  ]);
}

export function getOfflineDeviceId(): string {
  const storageKey = "anjolav:offline-device-id";
  const existing = localStorage.getItem(storageKey);
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(storageKey, created);
  return created;
}

export async function enqueueOfflinePdvSale(input: {
  userId: string;
  tenantId: string;
  area: "industrial" | "residencial";
  request: PdvSaleRequest;
  receipt: OfflinePdvReceipt;
}): Promise<OfflinePdvQueueItem> {
  if (input.request.payment !== null || input.request.cashRegisterId !== null) {
    throw new Error("Pagamentos e movimentações de caixa não podem ser enfileirados offline");
  }
  const id = `pdv-outbox:${input.userId}:${input.request.idempotencyKey}`;
  const existing = await getRecord(id);
  if (existing) return decryptQueueRecord(existing);

  const now = new Date().toISOString();
  const payload: OfflinePdvQueuePayload = { request: input.request, receipt: input.receipt };
  const record: EncryptedRecord = {
    id,
    kind: "pdv-outbox",
    userId: input.userId,
    tenantId: input.tenantId,
    area: input.area,
    status: "pending",
    createdAt: now,
    updatedAt: now,
    attempts: 0,
    lastError: null,
    payload: await encryptValue(input.userId, payload),
  };
  await putRecord(record);
  return decryptQueueRecord(record);
}

async function decryptQueueRecord(record: EncryptedRecord): Promise<OfflinePdvQueueItem> {
  if (record.kind !== "pdv-outbox" || !record.tenantId || !record.area || !record.status) {
    throw new Error("Registro offline inválido");
  }
  const payload = await decryptValue<OfflinePdvQueuePayload>(record.userId, record.payload);
  return {
    id: record.id,
    userId: record.userId,
    tenantId: record.tenantId,
    area: record.area,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    attempts: record.attempts,
    lastError: record.lastError,
    request: payload.request,
    receipt: payload.receipt,
    result: payload.result,
    syncedAt: payload.syncedAt,
  };
}

export async function listOfflinePdvQueue(userId: string, tenantId: string): Promise<OfflinePdvQueueItem[]> {
  const records = await listRecordsForUser(userId);
  const matching = records.filter((record) => record.kind === "pdv-outbox" && record.tenantId === tenantId);
  const items = await Promise.all(matching.map((record) => decryptQueueRecord(record)));
  return items.sort((first, second) => first.createdAt.localeCompare(second.createdAt));
}

export async function updateOfflinePdvQueueItem(
  id: string,
  update: {
    status: OfflinePdvQueueStatus;
    lastError?: string | null;
    incrementAttempts?: boolean;
    result?: PdvSaleResult;
  },
): Promise<OfflinePdvQueueItem> {
  const record = await getRecord(id);
  if (!record || record.kind !== "pdv-outbox") throw new Error("ROL offline não encontrado");
  const payload = await decryptValue<OfflinePdvQueuePayload>(record.userId, record.payload);
  if (update.result) {
    payload.result = update.result;
    payload.syncedAt = new Date().toISOString();
  }
  const next: EncryptedRecord = {
    ...record,
    status: update.status,
    updatedAt: new Date().toISOString(),
    attempts: record.attempts + (update.incrementAttempts ? 1 : 0),
    lastError: update.lastError === undefined ? record.lastError : update.lastError,
    payload: await encryptValue(record.userId, payload),
  };
  await putRecord(next);
  return decryptQueueRecord(next);
}

export async function resetInterruptedOfflineSync(userId: string, tenantId: string): Promise<void> {
  const items = await listOfflinePdvQueue(userId, tenantId);
  await Promise.all(items
    .filter((item) => item.status === "syncing")
    .map((item) => updateOfflinePdvQueueItem(item.id, {
      status: "pending",
      lastError: "A sincronização anterior foi interrompida e será retomada.",
    })));
}

export async function pruneSyncedOfflinePdvQueue(userId: string, tenantId: string, olderThanMs = 48 * 60 * 60 * 1_000): Promise<void> {
  const threshold = Date.now() - olderThanMs;
  const items = await listOfflinePdvQueue(userId, tenantId);
  await Promise.all(items
    .filter((item) => item.status === "synced" && Date.parse(item.updatedAt) < threshold)
    .map((item) => deleteRecord(item.id)));
}

export async function checkOfflineStorageAvailable(): Promise<boolean> {
  try {
    await openDatabase();
    return true;
  } catch {
    return false;
  }
}
