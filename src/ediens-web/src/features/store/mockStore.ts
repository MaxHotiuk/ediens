/**
 * Central State Store & Mock Data Engine for ēdiens
 * Supports FEFO sorting, optimistic concurrency control (ETag),
 * RFC 9457 error simulation, 1-Click Cook transactional execution,
 * and offline-first shopping list persistence.
 */

import {
  InventoryItem,
  StorageLocation,
  MeasurementUnit,
  FreshnessStatus,
  NutritionTargets,
  MacroProgress,
  Recipe,
  ShoppingListItem,
  MealLog,
  ProblemDetails,
  InsufficientInventoryExtensions,
  ConcurrentModificationExtensions,
} from '../../types/api';
import { errorBus } from '../../api/errorHandler';
import { generateUuid } from '../../api/client';

// ============================================================================
// Helpers: FEFO & Freshness Calculation
// ============================================================================

export function calculateFreshness(expiresAtIso: string): {
  freshnessStatus: FreshnessStatus;
  daysUntilExpiration: number;
} {
  const now = new Date();
  const exp = new Date(expiresAtIso);
  const diffMs = exp.getTime() - now.getTime();
  const daysUntilExpiration = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  let freshnessStatus: FreshnessStatus = 'FRESH';
  if (daysUntilExpiration < 0) {
    freshnessStatus = 'EXPIRED';
  } else if (daysUntilExpiration <= 1) {
    freshnessStatus = 'CRITICAL';
  } else if (daysUntilExpiration <= 3) {
    freshnessStatus = 'EXPIRING_SOON';
  } else {
    freshnessStatus = 'FRESH';
  }

  return { freshnessStatus, daysUntilExpiration };
}

// ============================================================================
// Initial Seed Data
// ============================================================================

const SEED_INVENTORY: InventoryItem[] = [
  {
    id: 'item-01',
    householdId: 'hh-podil-01',
    productName: "Куряче філе охолоджене",
    location: 'Fridge',
    quantity: 500,
    unit: 'g',
    expiresAt: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(), // ~18 hours (CRITICAL)
    etag: 'W/"10421"',
    freshnessStatus: 'CRITICAL',
    daysUntilExpiration: 0,
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'item-02',
    householdId: 'hh-podil-01',
    productName: "Шпинат свіжий 'Вересень'",
    location: 'Fridge',
    quantity: 200,
    unit: 'g',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // ~24 hours (CRITICAL)
    etag: 'W/"10422"',
    freshnessStatus: 'CRITICAL',
    daysUntilExpiration: 1,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'item-03',
    householdId: 'hh-podil-01',
    productName: "Молоко 'Селянське' 2.5%",
    location: 'Fridge',
    quantity: 800,
    unit: 'ml',
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 2 days (EXPIRING_SOON)
    etag: 'W/"10423"',
    freshnessStatus: 'EXPIRING_SOON',
    daysUntilExpiration: 2,
    createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'item-04',
    householdId: 'hh-podil-01',
    productName: "Сир кисломолочний 5% 'Яготинський'",
    location: 'Fridge',
    quantity: 350,
    unit: 'g',
    expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(), // 3 days (EXPIRING_SOON)
    etag: 'W/"10424"',
    freshnessStatus: 'EXPIRING_SOON',
    daysUntilExpiration: 3,
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'item-05',
    householdId: 'hh-podil-01',
    productName: "Яйця курячі C0 (десяток)",
    location: 'Fridge',
    quantity: 6,
    unit: 'pcs',
    expiresAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(), // 8 days (FRESH)
    etag: 'W/"10425"',
    freshnessStatus: 'FRESH',
    daysUntilExpiration: 8,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'item-06',
    householdId: 'hh-podil-01',
    productName: "Філе лосося слабосолене",
    location: 'Fridge',
    quantity: 180,
    unit: 'g',
    expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days (FRESH)
    etag: 'W/"10426"',
    freshnessStatus: 'FRESH',
    daysUntilExpiration: 5,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'item-07',
    householdId: 'hh-podil-01',
    productName: "Заморожені овочі 'Мексиканська суміш'",
    location: 'Freezer',
    quantity: 400,
    unit: 'g',
    expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days
    etag: 'W/"10427"',
    freshnessStatus: 'FRESH',
    daysUntilExpiration: 60,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'item-08',
    householdId: 'hh-podil-01',
    productName: "Вівсяні пластівці 'Ніжні' №1",
    location: 'Pantry',
    quantity: 750,
    unit: 'g',
    expiresAt: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString(), // 120 days
    etag: 'W/"10428"',
    freshnessStatus: 'FRESH',
    daysUntilExpiration: 120,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'item-09',
    householdId: 'hh-podil-01',
    productName: "Гречана крупа ядриця",
    location: 'Pantry',
    quantity: 900,
    unit: 'g',
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    etag: 'W/"10429"',
    freshnessStatus: 'FRESH',
    daysUntilExpiration: 90,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'item-10',
    householdId: 'hh-podil-01',
    productName: "Йогурт грецький 2% (прострочений)",
    location: 'Fridge',
    quantity: 200,
    unit: 'g',
    expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // -1 day (EXPIRED)
    etag: 'W/"10430"',
    freshnessStatus: 'EXPIRED',
    daysUntilExpiration: -1,
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const SEED_NUTRITION_TARGETS: NutritionTargets = {
  id: 'target-01',
  userId: 'user-oleg-01',
  targetCalories: 2200,
  targetProtein: 160,
  targetFat: 70,
  targetCarbs: 230,
};

const SEED_MEAL_LOGS: MealLog[] = [
  {
    id: 'meal-01',
    userId: 'user-oleg-01',
    loggedAt: new Date(new Date().setHours(8, 30, 0, 0)).toISOString(),
    mealType: 'Breakfast',
    calories: 460,
    protein: 32,
    fat: 14,
    carbs: 52,
    idempotencyKey: '0192e2b3-0001-7000-8000-000000000001',
    items: [
      { productName: "Вівсянка з бананом", quantity: 200, unit: 'g' },
      { productName: "Протеїн сироватковий", quantity: 30, unit: 'g' },
    ],
  },
  {
    id: 'meal-02',
    userId: 'user-oleg-01',
    loggedAt: new Date(new Date().setHours(13, 15, 0, 0)).toISOString(),
    mealType: 'Lunch',
    calories: 620,
    protein: 54,
    fat: 18,
    carbs: 60,
    idempotencyKey: '0192e2b3-0002-7000-8000-000000000002',
    items: [
      { productName: "Куряче філе су-від", quantity: 200, unit: 'g' },
      { productName: "Гречана каша відварена", quantity: 180, unit: 'g' },
      { productName: "Салат зі свіжих овочів", quantity: 150, unit: 'g' },
    ],
  },
];

const SEED_RECIPES: Recipe[] = [
  {
    id: 'recipe-01',
    title: "Протеїновий омлет зі шпинатом та сиром",
    description: "Ідеальний сніданок або перекус для добору білка. Утилізує шпинат та сир, що спливають у холодильнику.",
    instructions: "1. Розігрійте сковороду з краплею олії.\n2. Збийте 2 яйця з 50мл молока.\n3. Додайте нарізаний шпинат та 100г кисломолочного сиру.\n4. Готуйте під кришкою на слабкому вогні 7-8 хвилин.",
    prepTimeMinutes: 12,
    totalCalories: 380,
    totalProtein: 38,
    totalFat: 19,
    totalCarbs: 9,
    expiringStockMatchScore: 98,
    macroBudgetFitScore: 94,
    missingIngredientsCount: 0,
    ingredients: [
      { productId: 'item-05', productName: "Яйця курячі C0", quantity: 2, unit: 'pcs', isAvailable: true },
      { productId: 'item-02', productName: "Шпинат свіжий 'Вересень'", quantity: 100, unit: 'g', isAvailable: true },
      { productId: 'item-04', productName: "Сир кисломолочний 5%", quantity: 100, unit: 'g', isAvailable: true },
      { productId: 'item-03', productName: "Молоко 'Селянське' 2.5%", quantity: 50, unit: 'ml', isAvailable: true },
    ],
  },
  {
    id: 'recipe-02',
    title: "Куряче філе гриль з мексиканськими овочами",
    description: "Швидка вечеря з високим вмістом білка. Використовує критичне куряче філе та заморожені овочі.",
    instructions: "1. Замаринуйте філе у спеціях.\n2. Обсмажте на грилі або пательні по 4-5 хв з кожного боку.\n3. Обсмажте заморожені овочі 6-7 хв.\n4. Подавайте гарячим.",
    prepTimeMinutes: 20,
    totalCalories: 450,
    totalProtein: 52,
    totalFat: 12,
    totalCarbs: 28,
    expiringStockMatchScore: 95,
    macroBudgetFitScore: 88,
    missingIngredientsCount: 0,
    ingredients: [
      { productId: 'item-01', productName: "Куряче філе охолоджене", quantity: 250, unit: 'g', isAvailable: true },
      { productId: 'item-07', productName: "Заморожені овочі 'Мексиканська суміш'", quantity: 200, unit: 'g', isAvailable: true },
    ],
  },
  {
    id: 'recipe-03',
    title: "Кіноа Боул з запеченим лососем та авокадо",
    description: "Збалансований боул з корисними жирами Омега-3 та повільними вуглеводами. Бракує кіноа та авокадо.",
    instructions: "1. Відваріть кіноа 15 хв.\n2. Наріжте лосось та свіже авокадо слайсами.\n3. Викладіть кіноа в боул, зверху лосось, авокадо та свіжий шпинат.\n4. Скропіть лимонним соком.",
    prepTimeMinutes: 25,
    totalCalories: 560,
    totalProtein: 42,
    totalFat: 24,
    totalCarbs: 46,
    expiringStockMatchScore: 70,
    macroBudgetFitScore: 78,
    missingIngredientsCount: 2,
    ingredients: [
      { productId: 'item-06', productName: "Філе лосося слабосолене", quantity: 150, unit: 'g', isAvailable: true },
      { productId: 'item-02', productName: "Шпинат свіжий 'Вересень'", quantity: 50, unit: 'g', isAvailable: true },
      { productId: 'missing-01', productName: "Кіноа органічне", quantity: 100, unit: 'g', isAvailable: false },
      { productId: 'missing-02', productName: "Стигле авокадо Хаас", quantity: 1, unit: 'pcs', isAvailable: false },
    ],
  },
  {
    id: 'recipe-04',
    title: "Вівсяний смузі-боул з ягодами та мигдальним молоком",
    description: "Освіжаючий вуглеводний заряд перед тренуванням. Потребує покупки мигдального молока та ягід.",
    instructions: "1. Засипте вівсяні пластівці в блендер.\n2. Додайте мигдальне молоко та заморожені ягоди.\n3. Збийте до однорідної кремової текстури.",
    prepTimeMinutes: 5,
    totalCalories: 320,
    totalProtein: 14,
    totalFat: 8,
    totalCarbs: 48,
    expiringStockMatchScore: 50,
    macroBudgetFitScore: 82,
    missingIngredientsCount: 2,
    ingredients: [
      { productId: 'item-08', productName: "Вівсяні пластівці 'Ніжні'", quantity: 60, unit: 'g', isAvailable: true },
      { productId: 'missing-03', productName: "Мигдальне молоко без цукру", quantity: 250, unit: 'ml', isAvailable: false },
      { productId: 'missing-04', productName: "Заморожені чорниці або лохина", quantity: 120, unit: 'g', isAvailable: false },
    ],
  },
];

const SEED_SHOPPING_LIST: ShoppingListItem[] = [
  {
    id: 'shop-01',
    householdId: 'hh-podil-01',
    productName: "Яйця курячі C0 (десяток)",
    quantity: 1,
    unit: 'pcs',
    isPurchased: false,
    addedByUserId: 'user-anna-02',
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'shop-02',
    householdId: 'hh-podil-01',
    productName: "Гречана крупа",
    quantity: 1000,
    unit: 'g',
    isPurchased: true,
    addedByUserId: 'user-oleg-01',
    updatedAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'shop-03',
    householdId: 'hh-podil-01',
    productName: "Банани стиглі",
    quantity: 1000,
    unit: 'g',
    isPurchased: false,
    addedByUserId: 'user-anna-02',
    updatedAt: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: 'shop-04',
    householdId: 'hh-podil-01',
    productName: "Оливкова олія Extra Virgin",
    quantity: 500,
    unit: 'ml',
    isPurchased: true,
    addedByUserId: 'user-oleg-01',
    updatedAt: new Date(Date.now() - 14400000).toISOString(),
  },
];

// ============================================================================
// LocalStorage Persistence Keys
// ============================================================================

const STORAGE_KEYS = {
  INVENTORY: 'ediens_state_inventory_v1',
  TARGETS: 'ediens_state_targets_v1',
  MEALS: 'ediens_state_meals_v1',
  RECIPES: 'ediens_state_recipes_v1',
  SHOPPING: 'ediens_state_shopping_v1',
  OFFLINE_MODE: 'ediens_state_offline_mode_v1',
  OFFLINE_CHANGES: 'ediens_state_offline_changes_count_v1',
};

// ============================================================================
// State Store Class
// ============================================================================

class EdiensStore {
  private inventory: InventoryItem[] = [];
  private targets: NutritionTargets = SEED_NUTRITION_TARGETS;
  private mealLogs: MealLog[] = [];
  private recipes: Recipe[] = [];
  private shoppingList: ShoppingListItem[] = [];
  private isOfflineMode = false;
  private offlineChangesCount = 0;

  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const storedInv = localStorage.getItem(STORAGE_KEYS.INVENTORY);
      if (storedInv) {
        this.inventory = JSON.parse(storedInv).map((item: InventoryItem) => {
          const fresh = calculateFreshness(item.expiresAt);
          return { ...item, ...fresh };
        });
      } else {
        this.inventory = SEED_INVENTORY.map((item) => {
          const fresh = calculateFreshness(item.expiresAt);
          return { ...item, ...fresh };
        });
        this.saveInventory();
      }

      const storedTargets = localStorage.getItem(STORAGE_KEYS.TARGETS);
      this.targets = storedTargets ? JSON.parse(storedTargets) : SEED_NUTRITION_TARGETS;

      const storedMeals = localStorage.getItem(STORAGE_KEYS.MEALS);
      this.mealLogs = storedMeals ? JSON.parse(storedMeals) : SEED_MEAL_LOGS;

      const storedRecipes = localStorage.getItem(STORAGE_KEYS.RECIPES);
      this.recipes = storedRecipes ? JSON.parse(storedRecipes) : SEED_RECIPES;

      const storedShop = localStorage.getItem(STORAGE_KEYS.SHOPPING);
      this.shoppingList = storedShop ? JSON.parse(storedShop) : SEED_SHOPPING_LIST;

      const storedOffline = localStorage.getItem(STORAGE_KEYS.OFFLINE_MODE);
      this.isOfflineMode = storedOffline === 'true';

      const storedCount = localStorage.getItem(STORAGE_KEYS.OFFLINE_CHANGES);
      this.offlineChangesCount = storedCount ? parseInt(storedCount, 10) : 0;
    } catch (e) {
      console.warn('Failed to parse localStorage, resetting to defaults', e);
      this.inventory = SEED_INVENTORY;
      this.targets = SEED_NUTRITION_TARGETS;
      this.mealLogs = SEED_MEAL_LOGS;
      this.recipes = SEED_RECIPES;
      this.shoppingList = SEED_SHOPPING_LIST;
    }
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Error in store listener:', err);
      }
    });
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Persistence Helpers
  private saveInventory() {
    localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(this.inventory));
    this.notify();
  }

  private saveTargets() {
    localStorage.setItem(STORAGE_KEYS.TARGETS, JSON.stringify(this.targets));
    this.notify();
  }

  private saveMeals() {
    localStorage.setItem(STORAGE_KEYS.MEALS, JSON.stringify(this.mealLogs));
    this.notify();
  }

  private saveRecipes() {
    localStorage.setItem(STORAGE_KEYS.RECIPES, JSON.stringify(this.recipes));
    this.notify();
  }

  private saveShopping() {
    localStorage.setItem(STORAGE_KEYS.SHOPPING, JSON.stringify(this.shoppingList));
    localStorage.setItem(STORAGE_KEYS.OFFLINE_CHANGES, String(this.offlineChangesCount));
    this.notify();
  }

  // ==========================================================================
  // Offline & Connectivity
  // ==========================================================================
  public getOfflineMode(): boolean {
    return this.isOfflineMode;
  }

  public setOfflineMode(enabled: boolean) {
    this.isOfflineMode = enabled;
    localStorage.setItem(STORAGE_KEYS.OFFLINE_MODE, String(enabled));
    this.notify();
  }

  public getOfflineChangesCount(): number {
    return this.offlineChangesCount;
  }

  // ==========================================================================
  // Inventory Methods (FEFO, ETag OCC, CRUD)
  // ==========================================================================
  public getInventoryItems(filterLocation?: StorageLocation): InventoryItem[] {
    let items = [...this.inventory];
    if (filterLocation) {
      items = items.filter((i) => i.location === filterLocation);
    }
    // FEFO Sort: First Expired, First Out (daysUntilExpiration ASC)
    return items.sort((a, b) => {
      const expA = new Date(a.expiresAt).getTime();
      const expB = new Date(b.expiresAt).getTime();
      return expA - expB;
    });
  }

  public addInventoryItem(item: Omit<InventoryItem, 'id' | 'etag' | 'freshnessStatus' | 'daysUntilExpiration' | 'createdAt'>): InventoryItem {
    const { freshnessStatus, daysUntilExpiration } = calculateFreshness(item.expiresAt);
    const newItem: InventoryItem = {
      ...item,
      id: `item-${generateUuid().slice(0, 8)}`,
      etag: `W/"${Math.floor(10000 + Math.random() * 90000)}"`,
      freshnessStatus,
      daysUntilExpiration,
      createdAt: new Date().toISOString(),
    };

    this.inventory.push(newItem);
    this.saveInventory();
    return newItem;
  }

  /**
   * Updates quantity with Optimistic Concurrency Control check (ETag/xmin)
   */
  public updateInventoryQuantity(
    id: string,
    quantityDelta: number,
    ifMatchETag?: string
  ): { item?: InventoryItem; conflict?: boolean } {
    const index = this.inventory.findIndex((i) => i.id === id);
    if (index === -1) {
      errorBus.emit<ProblemDetails>('item-not-found', {
        type: 'https://ediens.app/errors/item-not-found',
        title: 'Resource Not Found',
        status: 404,
        errorCode: 'ITEM_NOT_FOUND',
        detail: `Партію товару ID ${id} не знайдено. Можливо, її вже видалено.`,
        traceId: `00-${generateUuid().replace(/-/g, '')}-01`,
      });
      return { conflict: false };
    }

    const currentItem = this.inventory[index];

    // Optimistic Concurrency Control validation: If-Match must match current etag
    if (ifMatchETag && currentItem.etag !== ifMatchETag) {
      // Trigger RFC 9457 409 Conflict
      const problem: ProblemDetails<ConcurrentModificationExtensions> = {
        type: 'https://ediens.app/errors/concurrent-modification',
        title: 'Conflict during state modification',
        status: 409,
        detail: `Складський залишок товару «${currentItem.productName}» був змінений іншим учасником сімʼї.`,
        errorCode: 'CONCURRENT_MODIFICATION',
        traceId: `00-${generateUuid().replace(/-/g, '')}-01`,
        extensions: {
          currentETag: currentItem.etag,
          currentQuantity: currentItem.quantity,
          unit: currentItem.unit,
          modifiedBy: 'користувачем Anna',
          modifiedAtUtc: new Date().toISOString(),
        },
      };
      errorBus.emit('concurrent-modification', problem);
      return { conflict: true };
    }

    const newQty = Math.max(0, currentItem.quantity + quantityDelta);
    const newETag = `W/"${Math.floor(10000 + Math.random() * 90000)}"`;

    if (newQty === 0) {
      // Consumed completely -> remove
      this.inventory.splice(index, 1);
    } else {
      this.inventory[index] = {
        ...currentItem,
        quantity: newQty,
        etag: newETag,
      };
    }

    this.saveInventory();
    return { item: this.inventory[index], conflict: false };
  }

  public deleteInventoryItem(id: string) {
    this.inventory = this.inventory.filter((i) => i.id !== id);
    this.saveInventory();
  }

  /**
   * Directly simulates a concurrent modification from another user on an item
   */
  public simulateExternalConflict(itemId: string) {
    const item = this.inventory.find((i) => i.id === itemId);
    if (!item) return;

    // Change server state in background to trigger conflict
    const simulatedServerQuantity = Math.max(50, Math.round(item.quantity * 0.6));
    const simulatedServerETag = `W/"${Math.floor(50000 + Math.random() * 40000)}"`;

    item.quantity = simulatedServerQuantity;
    item.etag = simulatedServerETag;
    this.saveInventory();

    errorBus.emit<ProblemDetails<ConcurrentModificationExtensions>>('concurrent-modification', {
      type: 'https://ediens.app/errors/concurrent-modification',
      title: 'Conflict during state modification',
      status: 409,
      detail: `Складський залишок «${item.productName}» щойно змінено користувачем Anna. Актуальний залишок: ${simulatedServerQuantity} ${item.unit}.`,
      errorCode: 'CONCURRENT_MODIFICATION',
      traceId: `00-${generateUuid().replace(/-/g, '')}-01`,
      extensions: {
        currentETag: simulatedServerETag,
        currentQuantity: simulatedServerQuantity,
        unit: item.unit,
        modifiedBy: 'користувачем Anna',
      },
    });
  }

  // ==========================================================================
  // Nutrition & Macro Methods
  // ==========================================================================
  public getNutritionTargets(): NutritionTargets {
    return { ...this.targets };
  }

  public updateNutritionTargets(newTargets: Partial<NutritionTargets>) {
    this.targets = { ...this.targets, ...newTargets };
    this.saveTargets();
  }

  public getMealLogs(): MealLog[] {
    return [...this.mealLogs].sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());
  }

  public logMeal(meal: Omit<MealLog, 'id' | 'loggedAt'>): MealLog {
    const newMeal: MealLog = {
      ...meal,
      id: `meal-${generateUuid().slice(0, 8)}`,
      loggedAt: new Date().toISOString(),
      idempotencyKey: meal.idempotencyKey || generateUuid(),
    };

    this.mealLogs.unshift(newMeal);
    this.saveMeals();
    return newMeal;
  }

  public deleteMealLog(id: string) {
    this.mealLogs = this.mealLogs.filter((m) => m.id !== id);
    this.saveMeals();
  }

  public getMacroProgress(): MacroProgress {
    const logged = this.mealLogs.reduce(
      (acc, m) => ({
        calories: acc.calories + m.calories,
        protein: acc.protein + m.protein,
        fat: acc.fat + m.fat,
        carbs: acc.carbs + m.carbs,
      }),
      { calories: 0, protein: 0, fat: 0, carbs: 0 }
    );

    return {
      calories: {
        current: logged.calories,
        target: this.targets.targetCalories,
        remaining: Math.max(0, this.targets.targetCalories - logged.calories),
      },
      protein: {
        current: logged.protein,
        target: this.targets.targetProtein,
        remaining: Math.max(0, this.targets.targetProtein - logged.protein),
      },
      fat: {
        current: logged.fat,
        target: this.targets.targetFat,
        remaining: Math.max(0, this.targets.targetFat - logged.fat),
      },
      carbs: {
        current: logged.carbs,
        target: this.targets.targetCarbs,
        remaining: Math.max(0, this.targets.targetCarbs - logged.carbs),
      },
    };
  }

  // ==========================================================================
  // Recipes & 1-Click Cook
  // ==========================================================================
  public getRecipes(): Recipe[] {
    return this.recipes.map((r) => {
      // Re-evaluate ingredient availability against live inventory
      const updatedIngredients = r.ingredients.map((ing) => {
        const matchingInventory = this.inventory.filter((inv) =>
          inv.productName.toLowerCase().includes(ing.productName.toLowerCase()) ||
          ing.productName.toLowerCase().includes(inv.productName.toLowerCase())
        );
        const totalAvailable = matchingInventory.reduce((sum, item) => sum + item.quantity, 0);
        return {
          ...ing,
          isAvailable: totalAvailable >= ing.quantity,
        };
      });

      const missingCount = updatedIngredients.filter((i) => !i.isAvailable).length;
      return {
        ...r,
        ingredients: updatedIngredients,
        missingIngredientsCount: missingCount,
      };
    });
  }

  /**
   * Executes 1-Click Cook transaction:
   * 1. Checks inventory for all ingredients
   * 2. If missing -> raises 422 INSUFFICIENT_INVENTORY ProblemDetails with missing list
   * 3. If sufficient -> deducts from inventory batches in FEFO order, creates MealLog, updates macros
   */
  public cookRecipe(recipeId: string): {
    success: boolean;
    missingIngredients?: InsufficientInventoryExtensions['missingIngredients'];
    mealLog?: MealLog;
  } {
    const recipe = this.getRecipes().find((r) => r.id === recipeId);
    if (!recipe) {
      errorBus.emit('item-not-found', {
        type: 'https://ediens.app/errors/item-not-found',
        title: 'Recipe Not Found',
        status: 404,
        errorCode: 'ITEM_NOT_FOUND',
        detail: 'Рецепт не знайдено або видалено.',
      });
      return { success: false };
    }

    // Step 1: Check availability
    const missing: InsufficientInventoryExtensions['missingIngredients'] = [];
    recipe.ingredients.forEach((ing) => {
      const matchingInventory = this.inventory.filter((inv) =>
        inv.productName.toLowerCase().includes(ing.productName.toLowerCase()) ||
        ing.productName.toLowerCase().includes(inv.productName.toLowerCase())
      );
      const totalAvailable = matchingInventory.reduce((sum, item) => sum + item.quantity, 0);
      if (totalAvailable < ing.quantity) {
        missing.push({
          productId: ing.productId,
          productName: ing.productName,
          requiredQuantity: ing.quantity,
          availableQuantity: totalAvailable,
          unit: ing.unit,
        });
      }
    });

    // Step 2: If insufficient -> trigger RFC 9457 422
    if (missing.length > 0) {
      const problem: ProblemDetails<InsufficientInventoryExtensions> = {
        type: 'https://ediens.app/errors/insufficient-inventory',
        title: 'Insufficient Inventory for 1-Click Cook',
        status: 422,
        errorCode: 'INSUFFICIENT_INVENTORY',
        detail: `Недостатньо складських залишків для приготування «${recipe.title}». Бракує ${missing.length} інгредієнт(ів).`,
        instance: `/api/v1/recipes/${recipe.id}/cook`,
        traceId: `00-${generateUuid().replace(/-/g, '')}-01`,
        extensions: {
          missingIngredients: missing,
        },
      };
      errorBus.emit('insufficient-inventory', problem);
      return { success: false, missingIngredients: missing };
    }

    // Step 3: Transactional deduction in FEFO order (oldest batches first)
    recipe.ingredients.forEach((ing) => {
      let needed = ing.quantity;
      const batches = this.inventory
        .filter((inv) =>
          inv.productName.toLowerCase().includes(ing.productName.toLowerCase()) ||
          ing.productName.toLowerCase().includes(inv.productName.toLowerCase())
        )
        .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());

      for (const batch of batches) {
        if (needed <= 0) break;
        const deduct = Math.min(batch.quantity, needed);
        batch.quantity -= deduct;
        batch.etag = `W/"${Math.floor(10000 + Math.random() * 90000)}"`;
        needed -= deduct;
      }
    });

    // Clean up empty batches
    this.inventory = this.inventory.filter((i) => i.quantity > 0);
    this.saveInventory();

    // Step 4: Add Meal Log
    const newMeal = this.logMeal({
      userId: 'user-oleg-01',
      mealType: 'Dinner',
      calories: recipe.totalCalories,
      protein: recipe.totalProtein,
      fat: recipe.totalFat,
      carbs: recipe.totalCarbs,
      idempotencyKey: generateUuid(),
      items: recipe.ingredients.map((i) => ({
        productName: i.productName,
        quantity: i.quantity,
        unit: i.unit,
      })),
    });

    return { success: true, mealLog: newMeal };
  }

  // ==========================================================================
  // Shopping List (Offline-First, Sync)
  // ==========================================================================
  public getShoppingList(): ShoppingListItem[] {
    return [...this.shoppingList].sort((a, b) => {
      if (a.isPurchased === b.isPurchased) {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      return a.isPurchased ? 1 : -1;
    });
  }

  public addShoppingItem(productName: string, quantity: number, unit: MeasurementUnit): ShoppingListItem {
    const newItem: ShoppingListItem = {
      id: `shop-${generateUuid().slice(0, 8)}`,
      householdId: 'hh-podil-01',
      productName,
      quantity,
      unit,
      isPurchased: false,
      addedByUserId: 'user-oleg-01',
      updatedAt: new Date().toISOString(),
    };

    this.shoppingList.unshift(newItem);
    if (this.isOfflineMode) {
      this.offlineChangesCount += 1;
    }
    this.saveShopping();
    return newItem;
  }

  public addMultipleShoppingItems(
    items: Array<{ productName: string; quantity: number; unit: MeasurementUnit }>
  ): ShoppingListItem[] {
    const created: ShoppingListItem[] = items.map((i) => ({
      id: `shop-${generateUuid().slice(0, 8)}`,
      householdId: 'hh-podil-01',
      productName: i.productName,
      quantity: i.quantity,
      unit: i.unit,
      isPurchased: false,
      addedByUserId: 'user-oleg-01',
      updatedAt: new Date().toISOString(),
    }));

    this.shoppingList.unshift(...created);
    if (this.isOfflineMode) {
      this.offlineChangesCount += created.length;
    }
    this.saveShopping();
    return created;
  }

  public toggleShoppingItemPurchased(id: string): boolean {
    const item = this.shoppingList.find((i) => i.id === id);
    if (!item) return false;

    item.isPurchased = !item.isPurchased;
    item.updatedAt = new Date().toISOString();

    if (this.isOfflineMode) {
      this.offlineChangesCount += 1;
    }
    this.saveShopping();
    return item.isPurchased;
  }

  public deleteShoppingItem(id: string) {
    this.shoppingList = this.shoppingList.filter((i) => i.id !== id);
    if (this.isOfflineMode) {
      this.offlineChangesCount += 1;
    }
    this.saveShopping();
  }

  public clearPurchasedShoppingItems() {
    const countBefore = this.shoppingList.length;
    this.shoppingList = this.shoppingList.filter((i) => !i.isPurchased);
    if (this.isOfflineMode) {
      this.offlineChangesCount += countBefore - this.shoppingList.length;
    }
    this.saveShopping();
  }

  public syncShoppingList(): { success: boolean; syncedItemsCount: number } {
    // In actual server integration, sends payload to POST /households/{id}/shopping-list/sync
    const count = this.offlineChangesCount;
    this.offlineChangesCount = 0;
    this.saveShopping();
    return { success: true, syncedItemsCount: count };
  }

  public resetAllToSeed() {
    this.inventory = SEED_INVENTORY.map((item) => {
      const fresh = calculateFreshness(item.expiresAt);
      return { ...item, ...fresh };
    });
    this.targets = SEED_NUTRITION_TARGETS;
    this.mealLogs = SEED_MEAL_LOGS;
    this.recipes = SEED_RECIPES;
    this.shoppingList = SEED_SHOPPING_LIST;
    this.offlineChangesCount = 0;
    this.saveInventory();
    this.saveTargets();
    this.saveMeals();
    this.saveRecipes();
    this.saveShopping();
  }
}

export const ediensStore = new EdiensStore();
