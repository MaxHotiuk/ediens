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
} from '../types/api';

// Generates RFC 4122 v4 UUID for Idempotency-Key & traceparent
export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Generates W3C TraceContext traceparent: 00-traceid-spanid-flags
function generateTraceparent(): string {
  const traceId = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const spanId = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `00-${traceId}-${spanId}-01`;
}

// Environment or default base API URL
const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const axiosInstance: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json, application/problem+json',
  },
});

// Request Interceptor: Attach Auth Token and W3C TraceContext
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('ediens_access_token');
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }

    if (!config.headers.has('traceparent')) {
      config.headers.set('traceparent', generateTraceparent());
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Route all errors through RFC 9457 Error Handler
axiosInstance.interceptors.response.use(
  (response) => {
    // If response contains an ETag, attach it to response data for convenience
    const etag = response.headers['etag'] || response.headers['ETag'];
    if (etag && response.data && typeof response.data === 'object' && !('etag' in response.data)) {
      (response.data as Record<string, unknown>).etag = etag;
    }
    return response;
  },
  (error) => {
    const apiError = handleApiError(error);
    return Promise.reject(apiError);
  }
);

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
      sortBy?: 'expiresAt' | 'createdAt' | 'quantity';
    }): Promise<InventoryItem[]> {
      const res = await axiosInstance.get<InventoryItem[]>('/inventory/items', { params });
      return res.data;
    },

    async getItemById(id: string): Promise<InventoryItem> {
      const res = await axiosInstance.get<InventoryItem>(`/inventory/items/${id}`);
      return res.data;
    },

    async addItem(item: CreateInventoryItemRequest): Promise<InventoryItem> {
      const res = await axiosInstance.post<InventoryItem>('/inventory/items', item);
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

    async deleteItem(id: string): Promise<void> {
      await axiosInstance.delete(`/inventory/items/${id}`);
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
      meal: Omit<MealLog, 'id' | 'loggedAt'>,
      idempotencyKey?: string
    ): Promise<MealLog> {
      const key = idempotencyKey || generateUuid();
      const res = await axiosInstance.post<MealLog>('/meals/log', meal, {
        headers: { 'Idempotency-Key': key },
      });
      return res.data;
    },
  },

  /**
   * Recipes & Smart Recommendations Module
   */
  recipes: {
    async getRecommendations(params?: {
      householdId?: string;
      maxPrepMinutes?: number;
    }): Promise<Recipe[]> {
      const res = await axiosInstance.get<Recipe[]>('/recipes/recommendations', { params });
      return res.data;
    },

    async cookRecipe(
      recipeId: string,
      idempotencyKey?: string
    ): Promise<{
      success: boolean;
      mealLogId: string;
      message: string;
      consumedIngredients: Array<{ productName: string; quantity: number; unit: string }>;
    }> {
      const key = idempotencyKey || generateUuid();
      const res = await axiosInstance.post(`/recipes/${recipeId}/cook`, {}, {
        headers: { 'Idempotency-Key': key },
      });
      return res.data;
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
    async getItems(householdId: string): Promise<ShoppingListItem[]> {
      const res = await axiosInstance.get<ShoppingListItem[]>(`/households/${householdId}/shopping-list`);
      return res.data;
    },

    async sync(
      householdId: string,
      items: ShoppingListItem[]
    ): Promise<ShoppingListItem[]> {
      const res = await axiosInstance.post<ShoppingListItem[]>(
        `/households/${householdId}/shopping-list/sync`,
        { items }
      );
      return res.data;
    },
  },
};

export default ediensApi;
