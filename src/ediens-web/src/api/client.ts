/**
 * ēdiens Type-Safe HTTP API Client
 * Built on Axios with W3C Distributed Tracing, ETag OCC, Idempotency-Key,
 * and RFC 9457 error interception.
 */

import axios, { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { handleApiError, EdiensApiError } from './errorHandler';
export { EdiensApiError };
import {
  InventoryItem,
  CreateInventoryItemRequest,
  UpdateInventoryItemQuantityRequest,
  NutritionTargets,
  MacroProgress,
  Recipe,
  ShoppingListItem,
  MealLog,
  StorageLocation,
  FreshnessStatus,
} from '../types/api';

export interface HouseholdSummary {
  id: string;
  name: string;
  inviteCode: string;
  role: string;
  membersCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface HouseholdMember {
  userId: string;
  email: string;
  role: string;
  joinedAt: string;
}

// Generates RFC 4122 v4 UUID for Idempotency-Key & traceparent using crypto.randomUUID()
export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Generates W3C TraceContext traceparent: 00-traceid-spanid-flags using crypto.randomUUID()
function generateTraceparent(): string {
  const raw1 = generateUuid().replace(/-/g, '');
  const raw2 = generateUuid().replace(/-/g, '');
  const traceId = (raw1 + raw2).substring(0, 32);
  const spanId = generateUuid().replace(/-/g, '').substring(0, 16);
  return `00-${traceId}-${spanId}-01`;
}

// Environment or default base API URL
const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';
export let DEFAULT_HOUSEHOLD_ID =
  import.meta.env.VITE_DEFAULT_HOUSEHOLD_ID || '0192e2b0-8812-7001-9011-aa9988776655';

export function getActiveHouseholdId(): string {
  return DEFAULT_HOUSEHOLD_ID;
}

export function setActiveHouseholdId(id: string): void {
  DEFAULT_HOUSEHOLD_ID = id;
}

export const axiosInstance: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json, application/problem+json',
  },
});

// In-memory Auth Token holder (no browser storage persistence)
let activeAuthToken: string | null = null;

export function setAuthToken(token: string | null): void {
  activeAuthToken = token;
}

export function getAuthToken(): string | null {
  return activeAuthToken;
}

// Request Interceptor: Attach Auth Token, W3C TraceContext, and Idempotency-Key
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAuthToken();
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }

    // Attach W3C TraceContext traceparent using crypto.randomUUID()
    if (!config.headers.has('traceparent')) {
      config.headers.set('traceparent', generateTraceparent());
    }

    // Attach Idempotency-Key for mutating HTTP methods using crypto.randomUUID()
    const method = config.method?.toUpperCase();
    if (
      (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') &&
      !config.headers.has('Idempotency-Key') &&
      !config.headers.has('idempotency-key')
    ) {
      config.headers.set('Idempotency-Key', generateUuid());
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Route all errors through RFC 9457 Error Handler & extract ETag
axiosInstance.interceptors.response.use(
  (response) => {
    // If response contains an ETag, attach it to response data for Optimistic Concurrency Control
    const etag =
      response.headers['etag'] ||
      response.headers['ETag'] ||
      (typeof response.headers?.get === 'function' ? response.headers.get('etag') : undefined);

    if (etag && response.data && typeof response.data === 'object') {
      if (!('etag' in response.data) || !(response.data as Record<string, unknown>).etag) {
        (response.data as Record<string, unknown>).etag = etag;
      }
    }
    return response;
  },
  (error) => {
    const apiError = handleApiError(error);
    return Promise.reject(apiError);
  }
);

// ============================================================================
// DTO Interfaces
// ============================================================================

export interface CookRecipeRequestPayload {
  householdId: string;
  servings?: number;
  mealType?: string;
}

export interface CookRecipeResponsePayload {
  success: boolean;
  recipeId: string;
  mealLogId: string;
  servingsCooked: number;
  mealType?: string;
  message?: string;
  deductedBatches: Array<{
    batchId: string;
    productName: string;
    deductedQuantity: number;
    remainingQuantity: number;
    unit: string;
  }>;
  loggedMacros: {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
  };
  consumedIngredients?: Array<{ productName: string; quantity: number; unit: string }>;
}

export interface ShoppingListClientChangePayload {
  id: string;
  productName: string;
  quantity: number;
  unit: string;
  isPurchased: boolean;
  clientUpdatedAt?: string;
}

export interface ShoppingListSyncRequestPayload {
  lastSyncTimestamp: string;
  clientChanges: ShoppingListClientChangePayload[];
}

export interface ShoppingListSyncResponsePayload {
  householdId: string;
  serverTimestamp: string;
  items: ShoppingListItem[];
}

export interface TransferShoppingListItemPayload {
  itemId: string;
  location?: StorageLocation | string;
  expiresAt?: string;
  quantity?: number;
  unit?: string;
}

export interface TransferShoppingListRequestPayload {
  items?: TransferShoppingListItemPayload[];
}

export interface TransferredInventoryItemSummary {
  id: string;
  productId: string;
  productName: string;
  location: string;
  quantity: number;
  unit: string;
  expiresAt: string;
}

export interface TransferShoppingListResponsePayload {
  transferredCount: number;
  transferredItems: TransferredInventoryItemSummary[];
  message: string;
}

export interface UpdateInventoryItemRequest {
  quantityDelta?: number;
  quantity?: number;
  location?: StorageLocation | string;
  expiresAt?: string;
  markOpened?: boolean;
}

// ============================================================================
// Type-Safe API Modules
// ============================================================================

export const ediensApi = {
  /**
   * Raw Axios client instance for custom queries
   */
  client: axiosInstance,

  /**
   * Inventory Module (FEFO, Batches, Optimistic Concurrency Control)
   */
  inventory: {
    async getItems(params?: {
      householdId?: string;
      location?: StorageLocation;
      status?: FreshnessStatus | string;
      sortBy?: 'expiresAt' | 'createdAt' | 'quantity';
    }): Promise<InventoryItem[]> {
      const queryParams = {
        householdId: params?.householdId || DEFAULT_HOUSEHOLD_ID,
        ...params,
      };
      const res = await axiosInstance.get<{ items: InventoryItem[]; totalCount?: number; householdId?: string } | InventoryItem[]>(
        '/inventory/items',
        { params: queryParams }
      );
      if (res.data && typeof res.data === 'object' && 'items' in res.data && Array.isArray((res.data as any).items)) {
        return (res.data as any).items;
      }
      if (Array.isArray(res.data)) {
        return res.data;
      }
      return [];
    },

    async getItemById(id: string): Promise<InventoryItem> {
      const res = await axiosInstance.get<InventoryItem>(`/inventory/items/${id}`);
      return res.data;
    },

    async addItem(item: CreateInventoryItemRequest): Promise<InventoryItem> {
      const payload = {
        ...item,
        householdId: item.householdId || DEFAULT_HOUSEHOLD_ID,
      };
      const res = await axiosInstance.post<InventoryItem>('/inventory/items', payload);
      return res.data;
    },

    async updateItem(
      id: string,
      request: UpdateInventoryItemRequest,
      etag?: string
    ): Promise<InventoryItem> {
      const config: AxiosRequestConfig = {};
      if (etag) {
        config.headers = { 'If-Match': etag };
      }
      const res = await axiosInstance.patch<InventoryItem>(`/inventory/items/${id}`, request, config);
      return res.data;
    },

    async updateQuantity(
      id: string,
      request: UpdateInventoryItemQuantityRequest,
      etag?: string
    ): Promise<InventoryItem> {
      const config: AxiosRequestConfig = {};
      if (etag) {
        config.headers = { 'If-Match': etag };
      }
      const res = await axiosInstance.patch<InventoryItem>(`/inventory/items/${id}`, request, config);
      return res.data;
    },

    async deleteItem(id: string, reason?: string): Promise<void> {
      await axiosInstance.delete(`/inventory/items/${id}`, {
        params: reason ? { reason } : undefined,
      });
    },
  },

  /**
   * Nutrition and Macronutrient Tracking Module
   */
  nutrition: {
    async getTargets(userId?: string): Promise<NutritionTargets> {
      const res = await axiosInstance.get<NutritionTargets>('/nutrition/targets', {
        params: userId ? { userId } : undefined,
      });
      return res.data;
    },

    async updateTargets(targets: NutritionTargets): Promise<NutritionTargets> {
      const res = await axiosInstance.put<NutritionTargets>('/nutrition/targets', targets);
      return res.data;
    },

    async getProgress(userId?: string, date?: string): Promise<MacroProgress> {
      const res = await axiosInstance.get<MacroProgress>('/nutrition/progress', {
        params: { userId, date },
      });
      return res.data;
    },
  },

  /**
   * Meal Logging Module (with Idempotency-Key)
   */
  meals: {
    async logMeal(
      meal:
        | {
            mealType: string;
            items: Array<{
              productId?: string;
              productName: string;
              quantity: number;
              unit: string;
            }>;
          }
        | Omit<MealLog, 'id' | 'loggedAt'>,
      idempotencyKey?: string
    ): Promise<MealLog> {
      const key = idempotencyKey || generateUuid();
      const res = await axiosInstance.post<MealLog>('/meals/log', meal, {
        headers: { 'Idempotency-Key': key },
      });
      return res.data;
    },

    async getMeals(params?: { userId?: string; date?: string }): Promise<MealLog[]> {
      const res = await axiosInstance.get<{ meals: MealLog[] } | MealLog[]>('/meals', { params });
      if (res.data && typeof res.data === 'object' && 'meals' in res.data && Array.isArray((res.data as any).meals)) {
        return (res.data as any).meals;
      }
      if (Array.isArray(res.data)) {
        return res.data;
      }
      return [];
    },

    async deleteMeal(id: string): Promise<void> {
      await axiosInstance.delete(`/meals/${id}`);
    },
  },

  /**
   * Recipes & Smart Recommendations Module
   */
  recipes: {
    async getRecommendations(params?: {
      householdId?: string;
      maxPrepMinutes?: number;
      maxPrepTimeMinutes?: number;
      limit?: number;
    }): Promise<Recipe[]> {
      const queryParams = {
        householdId: params?.householdId || DEFAULT_HOUSEHOLD_ID,
        maxPrepTimeMinutes: params?.maxPrepTimeMinutes ?? params?.maxPrepMinutes,
        limit: params?.limit,
      };
      const res = await axiosInstance.get<{ recommendations: Recipe[] } | Recipe[]>('/recipes/recommendations', {
        params: queryParams,
      });
      if (res.data && typeof res.data === 'object' && 'recommendations' in res.data && Array.isArray((res.data as any).recommendations)) {
        return (res.data as any).recommendations;
      }
      if (Array.isArray(res.data)) {
        return res.data;
      }
      return [];
    },

    async cookRecipe(
      recipeId: string,
      requestOrKey?:
        | {
            householdId?: string;
            servings?: number;
            mealType?: string;
          }
        | string,
      idempotencyKey?: string
    ): Promise<CookRecipeResponsePayload> {
      const isKey = typeof requestOrKey === 'string';
      const key = (isKey ? requestOrKey : idempotencyKey) || generateUuid();
      const reqObj = (!isKey && typeof requestOrKey === 'object' ? requestOrKey : {}) as {
        householdId?: string;
        servings?: number;
        mealType?: string;
      };
      const payload: CookRecipeRequestPayload = {
        householdId: reqObj.householdId || DEFAULT_HOUSEHOLD_ID,
        servings: reqObj.servings ?? 1,
        mealType: reqObj.mealType || 'Dinner',
      };
      const res = await axiosInstance.post<CookRecipeResponsePayload>(`/recipes/${recipeId}/cook`, payload, {
        headers: { 'Idempotency-Key': key },
      });
      return {
        ...res.data,
        mealType: res.data.mealType || payload.mealType,
        success: res.data.success ?? true,
      };
    },
  },

  /**
   * Products & Barcode Lookup
   */
  products: {
    async getByBarcode(barcode: string): Promise<{
      id: string;
      name: string;
      barcode: string;
      brand?: string;
      caloriesPer100g: number;
      proteinPer100g: number;
      fatPer100g: number;
      carbsPer100g: number;
    }> {
      const res = await axiosInstance.get(`/products/barcode/${barcode}`);
      return res.data;
    },
  },

  /**
   * Shopping List Module
   */
  shoppingList: {
    async getItems(householdId?: string): Promise<ShoppingListItem[]> {
      const id = householdId || DEFAULT_HOUSEHOLD_ID;
      const res = await axiosInstance.get<{ items: ShoppingListItem[]; householdId?: string; serverTimestamp?: string } | ShoppingListItem[]>(
        `/households/${id}/shopping-list`
      );
      if (res.data && typeof res.data === 'object' && 'items' in res.data && Array.isArray((res.data as any).items)) {
        return (res.data as any).items;
      }
      if (Array.isArray(res.data)) {
        return res.data;
      }
      return [];
    },

    async sync(
      householdId: string,
      request:
        | {
            lastSyncTimestamp?: string;
            clientChanges?: ShoppingListClientChangePayload[];
          }
        | ShoppingListItem[]
    ): Promise<ShoppingListItem[]> {
      const id = householdId || DEFAULT_HOUSEHOLD_ID;
      const payload: ShoppingListSyncRequestPayload = Array.isArray(request)
        ? {
            lastSyncTimestamp: new Date(0).toISOString(),
            clientChanges: request.map((item) => ({
              id: item.id,
              productName: item.productName,
              quantity: item.quantity,
              unit: item.unit,
              isPurchased: item.isPurchased,
              clientUpdatedAt: item.updatedAt || new Date().toISOString(),
            })),
          }
        : {
            lastSyncTimestamp: request.lastSyncTimestamp || new Date(0).toISOString(),
            clientChanges: request.clientChanges || [],
          };

      const res = await axiosInstance.post<ShoppingListSyncResponsePayload | ShoppingListItem[]>(
        `/households/${id}/shopping-list/sync`,
        payload
      );

      if (res.data && typeof res.data === 'object' && 'items' in res.data && Array.isArray((res.data as any).items)) {
        return (res.data as any).items;
      }
      if (Array.isArray(res.data)) {
        return res.data;
      }
      return [];
    },

    async deleteItem(householdId: string, itemId: string): Promise<void> {
      const id = householdId || DEFAULT_HOUSEHOLD_ID;
      await axiosInstance.delete(`/households/${id}/shopping-list/items/${itemId}`);
    },

    async clearPurchased(householdId: string): Promise<void> {
      const id = householdId || DEFAULT_HOUSEHOLD_ID;
      await axiosInstance.delete(`/households/${id}/shopping-list/purchased`);
    },

    async transferToInventory(
      householdId: string,
      request?: TransferShoppingListRequestPayload
    ): Promise<TransferShoppingListResponsePayload> {
      const id = householdId || DEFAULT_HOUSEHOLD_ID;
      const res = await axiosInstance.post<TransferShoppingListResponsePayload>(
        `/households/${id}/shopping-list/transfer-to-inventory`,
        request || {}
      );
      return res.data;
    },
  },

  /**
   * Households Module
   */
  households: {
    async getHouseholds(): Promise<HouseholdSummary[]> {
      const res = await axiosInstance.get<HouseholdSummary[]>('/households');
      return res.data;
    },

    async getHouseholdById(id: string): Promise<HouseholdSummary> {
      const res = await axiosInstance.get<HouseholdSummary>(`/households/${id}`);
      return res.data;
    },

    async joinHousehold(inviteCode: string): Promise<HouseholdSummary> {
      const res = await axiosInstance.post<HouseholdSummary>('/households/join', { inviteCode });
      return res.data;
    },

    async getMembers(householdId: string): Promise<HouseholdMember[]> {
      const res = await axiosInstance.get<HouseholdMember[]>(`/households/${householdId}/members`);
      return res.data;
    },
  },
};

export default ediensApi;
