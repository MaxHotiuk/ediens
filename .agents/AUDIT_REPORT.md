# .agents/AUDIT_REPORT.md — Phase 1 Codebase Integration & Kostyl Audit

**Author:** Lead Integration & Triage Agent  
**Date:** 2026-10-31  
**Target:** Phase 2 Zero-Fallback Stabilization  
**Scope:** `src/Ediens.Api`, `src/ediens-web`, `compose.yaml`, `infra/`, and `docs/Ediens_OpenAPI.yaml`

---

## Executive Summary

Phase 1 successfully delivered the architectural skeleton, specifications, and individual module implementations for ēdiens. However, a deep cross-layer audit reveals that **the frontend and backend are completely decoupled**. The React web frontend relies entirely on a 931-line in-memory mock engine (`mockStore.ts`) persisting to `localStorage`, while the .NET API endpoints remain untouched by the UI. 

Additionally, critical networking configurations (CORS, Vite proxy target, environment variables) and API contract mismatches (response wrapper DTOs, required query parameters, missing endpoint routes) prevent real HTTP integration out-of-the-box.

This audit details every identified shortcut, contract mismatch, and stub, establishing the technical baseline for stabilization tasks `FIX-01` through `FIX-06`.

---

## 1. Mock Data & "Vibecoding" Shortcuts in Frontend (`src/ediens-web`)

### 1.1 Central Fake Store (`src/ediens-web/src/features/store/mockStore.ts`)
- **Root Cause:** A complete 931-line fake backend simulation was implemented in `src/features/store/mockStore.ts`.
- **Hardcoded Seed Data:**
  - `SEED_INVENTORY` (10 hardcoded product batches with fake IDs: `'item-01'` to `'item-10'`).
  - `SEED_NUTRITION_TARGETS` (`'target-01'` for user `'user-oleg-01'`).
  - `SEED_MEAL_LOGS` (2 hardcoded meals with fake UUIDs).
  - `SEED_RECIPES` (3 hardcoded recipes with fake IDs and ingredient lists).
  - `SEED_SHOPPING_LIST` (6 hardcoded shopping items).
- **Fake Business Logic:**
  - `calculateFreshness`: Calculates days until expiration in frontend JavaScript rather than consuming backend status.
  - Concurrency conflict simulation (`result.conflict = true` when ETag doesn't match a hardcoded string).
  - "1-Click Cook" simulated transaction: deducts stock in local array and logs meals locally.
  - LocalStorage persistence under keys `ediens_state_inventory_v1`, `ediens_state_targets_v1`, etc.

### 1.2 Frontend Views Completely Bypassing API Client
None of the interactive feature components import or use `ediensApi` from `src/api/client.ts`. Every single view imports `ediensStore` from `mockStore.ts`:
- `src/features/inventory/InventoryDashboard.tsx` (`ediensStore.getInventoryItems`, `ediensStore.updateInventoryQuantity`).
- `src/features/recipes/RecipeRecommendationView.tsx` (`ediensStore.getRecipes`, `ediensStore.cookRecipe`).
- `src/features/macros/MacroTrackerView.tsx` (`ediensStore.getNutritionTargets`, `ediensStore.getMacroProgress`, `ediensStore.logMeal`).
- `src/features/shopping/ShoppingListView.tsx` (`ediensStore.getShoppingList`, `ediensStore.setOfflineMode`).
- `src/App.tsx` (subscribes to `ediensStore` for connectivity state and offline changes count).

### 1.3 Hardcoded Preset Products in Modals
- In `src/features/inventory/AddInventoryModal.tsx`, `PRESET_PRODUCTS` defines static product templates (`"Молоко фермерське"`, `"Яйця курячі C0"`, etc.) instead of fetching seeded products from `GET /api/v1/products` or barcode lookup.
- The Barcode Scanner lookup (`ediensApi.products.getByBarcode`) implemented in `client.ts` is never invoked in any UI view.

---

## 2. Networking, CORS & Proxy Failures

### 2.1 Vite Proxy Port Misconfiguration (`src/ediens-web/vite.config.ts`)
```ts
server: {
  port: 5173,
  host: true,
  proxy: {
    '/api': {
      target: 'http://localhost:5000', // BUG: .NET API runs on 5158 or 8080!
      changeOrigin: true,
      secure: false,
    },
  },
}
```
- In `src/Ediens.Api/Properties/launchSettings.json`, the local HTTP profile specifies `http://localhost:5158`.
- In `compose.yaml`, the container API port is `8080`.
- Vite forwards `/api` requests to port `5000`, causing immediate `ECONNREFUSED` on all API calls in development.

### 2.2 Missing `.env` Configuration in Frontend
- `src/ediens-web/src/api/client.ts` reads `const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';`.
- No `.env`, `.env.development`, or `.env.example` file exists in `src/ediens-web/`.
- While `/api/v1` relies on the Vite proxy in local dev, in production or docker setups where Vite dev server is not running, lack of environment variable control prevents targeting arbitrary API gateways.

### 2.3 Total Absence of CORS Configuration in Backend (`src/Ediens.Api/Program.cs`)
- `Program.cs` contains **zero** CORS registrations (`builder.Services.AddCors()` is missing, and `app.UseCors()` is never called).
- If the frontend connects directly to `http://localhost:5158` (or any cross-origin host), the browser immediately blocks the request.
- Critical HTTP headers are not exposed:
  - `ETag` (needed by React to extract optimistic concurrency tokens for `If-Match`).
  - `Retry-After` (needed by `RateLimitBanner` to parse 429 countdown).
  - `X-Correlation-Id` and `Location`.
  - Backend must configure `.WithExposedHeaders("ETag", "Retry-After", "X-Correlation-Id", "Location")`.

---

## 3. API Contract & DTO Mismatches

| Domain | Frontend Call (`client.ts` / UI) | Backend Reality (`Ediens.Api`) | Severity |
| :--- | :--- | :--- | :--- |
| **Inventory List** | `GET /inventory/items`<br>Expects `InventoryItem[]` array directly | `GET /api/v1/inventory/items`<br>Requires query param `householdId: Guid`. Returns `{ householdId, totalCount, items: [...] }` wrapper object | **High:** Fails with 400 Bad Request if `householdId` is missing; returns object instead of array. |
| **ID Format** | Frontend uses string IDs like `'item-01'`, `'user-oleg-01'`, `'hh-podil-01'` | Backend entities use RFC 4122 `Guid` (e.g. `0192e2b0-8812-7001-9011-aa9988776655`) | **High:** Guid parsing fails (`FormatException`), resulting in 400 Validation Problem. |
| **Macro Progress** | `client.ts` calls `GET /nutrition/progress` | Route does NOT exist in `NutritionEndpoints.cs`. | **Critical:** 404 Not Found. Backend only has `PUT /nutrition/targets` and `GET /nutrition/targets`. |
| **Meal History** | `MacroTrackerView` expects to list past logged meals | `MealEndpoints.cs` only has `POST /api/v1/meals/log`; lacks a `GET /api/v1/meals` query endpoint. | **High:** Frontend cannot retrieve logged meals from server. |
| **1-Click Cook** | `client.ts` posts empty body `{}` to `POST /recipes/{id}/cook` | Backend requires `CookRecipeRequest` with `{ householdId: Guid, servings: int, mealType: string }` | **Critical:** 400 Validation Problem or 403 Forbidden because `householdId` is Guid.Empty. |
| **Shopping List Sync** | `client.ts` sends `{ items: ShoppingListItem[] }` and expects `ShoppingListItem[]` response | Backend expects `{ lastSyncTimestamp: DateTime, clientChanges: [...] }` and returns `{ householdId, serverTimestamp, items: [...] }` | **Critical:** Request body mismatch and response unwrap failure. |
| **Product Barcode** | UI has no barcode scanner / lookup trigger wired | `GET /api/v1/products/barcode/{code}` is functional in backend with regex `^\d{8,13}$`, but orphaned from frontend. | **Medium:** Feature unreachable by user. |

---

## 4. Backend Persistence, Database Seeding & Migration Gaps

### 4.1 Missing Database Migrations
- `src/Ediens.Api/` has no `Migrations/` directory.
- `Program.cs` relies on `await db.Database.EnsureCreatedAsync()`.
- While `EnsureCreatedAsync()` builds the schema on empty databases, it does not support incremental evolution and is wrapped in a catch block that logs a warning and proceeds, potentially masking connection failures.

### 4.2 Seed Data Incompleteness
- `DatabaseSeeder.cs` seeds Users, Households, HouseholdMembers, Products, Recipes, and NutritionTargets.
- **Missing Seeds:**
  - Zero `InventoryItems` are seeded. On initial startup with a real database, the pantry and fridge are completely empty.
  - Zero `ShoppingListItems` are seeded.
  - Seeded entities use fixed Guids (`OlegUserId = 0192e2b0-0000-7000-8000-000000000001`, `MainHouseholdId = 0192e2b0-8812-7001-9011-aa9988776655`), but the frontend store was seeded with arbitrary strings (`'hh-podil-01'`).

### 4.3 Household Endpoints Missing
- `Household` and `HouseholdMember` tables exist in EF Core, but there are no REST endpoints to query a user's households (`GET /api/v1/households`) or switch active household context.

---

## 5. Verification & Testing Deficiencies

1. `scripts/verify.sh` did not scan frontend code for mock stores or fake data engines.
2. `src/Ediens.Tests/` uses `WebApplicationFactory` with an in-memory database (`UseInMemoryDatabase`), which passes unit tests but never verified real PostgreSQL connection, migration execution, or CORS headers.
3. No automated smoke test script existed to verify the live containerized or running API against all 10 OpenAPI endpoints and RFC 9457 error contracts.

---

## 6. Action Plan & Task Breakdown (Phase 2)

To systematically eliminate all fallbacks and establish end-to-end integration, 6 atomic tasks are defined:

1. **`FIX-01`**: Backend Real DB Persistence, Seeding, Migrations & CORS/Headers
2. **`FIX-02`**: Frontend API Client, Vite Proxy & De-Mocking Core (Runs in parallel with FIX-01)
3. **`FIX-03`**: End-to-End Fix: Inventory & Barcode Slices (Backend + Frontend)
4. **`FIX-04`**: End-to-End Fix: Meals, Macros & Smart Recipes Slices (Backend + Frontend)
5. **`FIX-05`**: End-to-End Fix: Households & Shopping List Sync + OpenAPI Alignment
6. **`FIX-06`**: Docker Compose Full-Stack Integration & E2E Smoke Verification
