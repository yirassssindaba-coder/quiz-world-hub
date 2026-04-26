export type ModelPlacement = 'hero' | 'globe' | 'ambient' | 'news' | 'dashboard';

export interface ModelAsset {
  id: string;
  name: string;
  description: string;
  placement: ModelPlacement;
  version: string;
  modelFileName: string;
  modelMimeType: string;
  thumbnailDataUrl?: string;
  fallbackDataUrl?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ModelAssetWithData extends ModelAsset {
  modelDataUrl?: string;
}

const META_KEY = 'gqth_3d_model_assets';
const DB_NAME = 'gqth_3d_assets';
const STORE_NAME = 'models';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putModelData(id: string, dataUrl: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(dataUrl, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getModelData(id: string): Promise<string | undefined> {
  const db = await openDb();
  const result = await new Promise<string | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function getModelAssets(): ModelAsset[] {
  try {
    return JSON.parse(localStorage.getItem(META_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveModelAssets(assets: ModelAsset[]) {
  localStorage.setItem(META_KEY, JSON.stringify(assets));
}

export async function createModelAsset(input: {
  name: string;
  description: string;
  placement: ModelPlacement;
  version: string;
  modelFile: File;
  thumbnailFile?: File | null;
  fallbackFile?: File | null;
}): Promise<ModelAsset> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const [modelDataUrl, thumbnailDataUrl, fallbackDataUrl] = await Promise.all([
    readFileAsDataUrl(input.modelFile),
    input.thumbnailFile ? readFileAsDataUrl(input.thumbnailFile) : Promise.resolve(undefined),
    input.fallbackFile ? readFileAsDataUrl(input.fallbackFile) : Promise.resolve(undefined),
  ]);
  await putModelData(id, modelDataUrl);
  const next: ModelAsset = {
    id,
    name: input.name,
    description: input.description,
    placement: input.placement,
    version: input.version,
    modelFileName: input.modelFile.name,
    modelMimeType: input.modelFile.type || 'model/gltf-binary',
    thumbnailDataUrl,
    fallbackDataUrl,
    active: false,
    createdAt: now,
    updatedAt: now,
  };
  saveModelAssets([next, ...getModelAssets()]);
  return next;
}

export function updateModelAsset(id: string, patch: Partial<ModelAsset>) {
  const assets = getModelAssets().map(asset => asset.id === id ? { ...asset, ...patch, updatedAt: new Date().toISOString() } : asset);
  saveModelAssets(assets);
  return assets;
}

export function setActiveModel(id: string, placement: ModelPlacement, active: boolean) {
  const assets = getModelAssets().map(asset => {
    if (asset.placement !== placement) return asset;
    if (asset.id === id) return { ...asset, active, updatedAt: new Date().toISOString() };
    return active ? { ...asset, active: false, updatedAt: new Date().toISOString() } : asset;
  });
  saveModelAssets(assets);
  return assets;
}

export function deleteModelAsset(id: string) {
  const assets = getModelAssets().filter(asset => asset.id !== id);
  saveModelAssets(assets);
  return assets;
}

export async function getActiveModel(placement: ModelPlacement): Promise<ModelAssetWithData | null> {
  const asset = getModelAssets().find(item => item.placement === placement && item.active);
  if (!asset) return null;
  const modelDataUrl = await getModelData(asset.id);
  return { ...asset, modelDataUrl };
}