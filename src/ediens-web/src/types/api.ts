/**
 * ēdiens API & RFC 9457 Type Definitions
 * Derived from docs/Ediens_OpenAPI.yaml & docs/Ediens_SRS/05-error-handling.md
 */

// ============================================================================
// Core Enums
// ============================================================================
export type StorageLocation = 'Fridge' | 'Freezer' | 'Pantry';

export type MeasurementUnit = 'g' | 'ml' | 'pcs';

export type MealType = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';

export type FreshnessStatus = 'FRESH' | 'EXPIRING_SOON' | 'CRITICAL' | 'EXPIRED';

// ============================================================================
// RFC 9457 Problem Details Specifications
// ============================================================================
export type ProblemErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHORIZED_ACCESS'
  | 'HOUSEHOLD_ACCESS_DENIED'
  | 'ITEM_NOT_FOUND'
  | 'CONCURRENT_MODIFICATION'
  | 'IDEMPOTENCY_CONFLICT'
  | 'DOMAIN_INVARIANT_VIOLATION'
  | 'INSUFFICIENT_INVENTORY'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INTERNAL_SERVER_ERROR'
  | 'EXTERNAL_SERVICE_UNAVAILABLE';

export interface ValidationErrorField {
  field: string;
  message: string;
  attemptedValue?: unknown;
}

export interface ConcurrentModificationExtensions {
  currentETag: string;
  currentQuantity: number;
  unit: MeasurementUnit;
  modifiedBy?: string;
  modifiedAtUtc?: string;
  [key: string]: unknown;
}

export interface InsufficientInventoryExtensions {
  missingIngredients: Array<{
    productId?: string;
    productName: string;
    requiredQuantity: number;
    availableQuantity: number;
    unit: MeasurementUnit;
  }>;
  [key: string]: unknown;
}

export interface RateLimitExtensions {
  retryAfterSeconds: number;
  limit?: number;
  windowSeconds?: number;
  [key: string]: unknown;
}

export interface HouseholdAccessDeniedExtensions {
  householdId?: string;
  requiredRole?: string;
  currentMembershipStatus?: string;
  [key: string]: unknown;
}

export interface ItemNotFoundExtensions {
  resourceType?: string;
  resourceId?: string;
  searchedAtUtc?: string;
  [key: string]: unknown;
}

export interface IdempotencyConflictExtensions {
  lockExpiresInMs: number;
  status?: string;
  [key: string]: unknown;
}

export interface ProblemDetails<TExtensions = Record<string, unknown>> {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errorCode: ProblemErrorCode | string;
  traceId?: string;
  timestamp?: string;
  errors?: Record<string, string[]> | ValidationErrorField[];
  extensions?: TExtensions;
}

// ============================================================================
// Domain Entities & DTOs
// ============================================================================
export interface InventoryItem {
  id: string;
  householdId: string;
  productId?: string | null;
  productName: string;
  location: StorageLocation;
  quantity: number;
  unit: MeasurementUnit;
  expiresAt: string;
  openedAt?: string | null;
  etag: string;
  freshnessStatus: FreshnessStatus;
  daysUntilExpiration: number;
  createdAt?: string;
}

export interface CreateInventoryItemRequest {
  householdId: string;
  productId?: string | null;
  productName: string;
  location: StorageLocation;
  quantity: number;
  unit: MeasurementUnit;
  expiresAt: string;
  openedAt?: string | null;
}

export interface UpdateInventoryItemQuantityRequest {
  quantityDelta: number;
  markOpened?: boolean;
}

export interface NutritionTargets {
  id?: string;
  userId?: string;
  targetCalories: number;
  targetProtein: number;
  targetFat: number;
  targetCarbs: number;
  effectiveFrom?: string;
}

export interface MacroProgress {
  calories: { current: number; target: number; remaining: number };
  protein: { current: number; target: number; remaining: number };
  fat: { current: number; target: number; remaining: number };
  carbs: { current: number; target: number; remaining: number };
}

export interface RecipeIngredient {
  productId: string;
  productName: string;
  quantity: number;
  unit: MeasurementUnit;
  isAvailable?: boolean;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  instructions: string;
  totalCalories: number;
  totalProtein: number;
  totalFat: number;
  totalCarbs: number;
  prepTimeMinutes: number;
  ingredients: RecipeIngredient[];
  expiringStockMatchScore?: number;
  macroBudgetFitScore?: number;
  missingIngredientsCount?: number;
}

export interface ShoppingListItem {
  id: string;
  householdId: string;
  productName: string;
  quantity: number;
  unit: MeasurementUnit;
  isPurchased: boolean;
  addedByUserId?: string;
  updatedAt: string;
}

export interface MealLogItem {
  productId?: string;
  productName: string;
  quantity: number;
  unit: MeasurementUnit;
}

export interface MealLog {
  id: string;
  userId: string;
  loggedAt: string;
  mealType: MealType;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  idempotencyKey?: string;
  items?: MealLogItem[];
}
