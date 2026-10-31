# .agents/KNOWLEDGE.md — Single Source of Truth for ēdiens

> **Project Name:** ēdiens (латис. *ēdiens* — «їжа», «страва»)
> **Tagline:** Єдиний хаб для управління запасами продуктів, підрахунку макросів та рекомендацій рецептів.
> **Language Standards:** Вся документація (SRS, концептуальні описи, описи OpenAPI ендпоінтів) ведеться **українською мовою**. Код, назви полів, типи, ідентифікатори, коміти та HTTP-заголовки — **англійською мовою**.

---

## 1. Domain Overview & Core Concepts

### 1.1 Мета системи (System Purpose)
Система **ēdiens** об'єднує в єдиний синхронізований контур три ключові підсистеми домашнього харчування:
1. **Управління складськими запасами (Inventory Management with FEFO):** Облік партій продуктів (batches) у холодильнику, морозильній камері та коморі за принципом **FEFO** (*First Expired, First Out* — перший закінчується строк придатності, перший споживається). Запобігання псуванню їжі (Food Waste Reduction).
2. **Нутриціологія та трекінг макронутрієнтів (Macronutrient Tracking):** Контроль добового балансу калорій ($E$, kcal), білків ($P$, g), жирів ($F$, g) та вуглеводів ($C$, g). Динамічний перерахунок залишку макро-бюджету протягом дня.
3. **Розумний підбір та списання рецептів (Smart Recipe Recommendations & 1-Click Cook):** Алгоритм рекомендації страв на основі двох критеріїв: (1) максимальне використання інгредієнтів, термін придатності яких спливає найближчим часом; (2) відповідність КБЖВ страви залишковому макро-бюджету користувача. Атомарна операція списання інгредієнтів зі складу та одночасного логування макросів у щоденник прийому їжі («Cook Recipe»).

### 1.2 Глосарій (Glossary)
- **Household (Домогосподарство):** Базова одиниця спільного володіння запасами та списком покупок. Об'єднує декількох користувачів із ролями (`Owner`, `Member`).
- **Inventory Item / Batch (Партія продукту):** Одиниця зберігання конкретного продукту з фіксованим терміном придатності (`expires_at`), датою відкриття (`opened_at`), локацією (`Fridge`, `Freezer`, `Pantry`) та поточною кількістю (`quantity`, `unit`).
- **FEFO (First Expired, First Out):** Сортування партій продукту, де першими до споживання пропонуються ті одиниці, у яких дата закінчення терміну придатності є найближчою.
- **Macro Target (Добовий цільовий профіль):** Індивідуальні норми споживання калорій, білків, жирів та вуглеводів на добу.
- **Remaining Macro Budget:** Добова норма мінус сума фактично спожитих макронутрієнтів за поточну дату: $\text{Budget}_{rem} = \text{Target} - \sum \text{LoggedMeals}$.
- **1-Click Cook:** Транзакційне виконання рецепту: автоматичне списання необхідної ваги інгредієнтів з найстаріших партій (FEFO) та додавання запису до щоденника прийомів їжі без ручного введення.

---

## 2. SRS Requirements Specification

### 2.1 Актори та персони (Actors & Personas)
У документації `docs/Ediens_SRS/03-product-description.md` визначаються 3 ключові персони:
1. **Персона 1: Meal Prepper / Nutrition Tracker (Олег, 28 років):**
   - *Профіль:* Активно займається спортом, дотримується суворого профілю БЖВ (High Protein / Moderate Carb).
   - *Потреби:* Швидке логування прийомів їжі (сканування штрих-коду EAN-13), пошук рецептів, які «добивають» залишок білка на вечір і використовують наявний у холодильнику сир або куряче філе.
   - *Ключові сценарії:* Перегляд макро-кільця, 1-Click Cook, внесення добових цілей.
2. **Персона 2: Household Member / Co-resident (Анна, 30 років):**
   - *Профіль:* Співмешканка, яка готує для сім'ї та поповнює запаси під час покупок.
   - *Потреби:* Спільний доступ до вмісту холодильника в реальному часі. Уникнення дублюючих покупок. Доступ до синхронізованого списку покупок, що формується автоматично на основі списаних або закінчених продуктів.
   - *Ключові сценарії:* Конкурентне редагування запасів (зменшення залишку молока), синхронізація кошика покупок у супермаркеті в умовах нестабільного зв'язку.
3. **Персона 3: Background Nutrition & Recipe Engine Worker (Фоновий системний агент):**
   - *Профіль:* Автономний системний процес / демон.
   - *Потреби:* Обробка асинхронних подій з Transactional Outbox (оновлення рецептурних індексів, перерахунок скорингу страв при додаванні нових продуктів), оновлення кешу харчової цінності з Open Food Facts API, надсилання push-сповіщень про критичні терміни придатності ($T \le 24$ години).

### 2.2 Функціональні вимоги (FR-01 — FR-12)
- **FR-01 (Inventory Batch CRUD):** Додавання, перегляд, оновлення та видалення партій продуктів із зазначенням назви, штрих-коду, кількості, одиниці виміру (`g`, `ml`, `pcs`), локації (`Fridge`, `Freezer`, `Pantry`) та дати `expires_at`.
- **FR-02 (FEFO Expiration Tracking & Sorting):** Відображення списку запасів з автоматичним сортуванням за терміном придатності (`expires_at ASC`), кольоровим індикатором свіжості (Green: >3 днів; Amber: 1–3 дні; Red: <24 годин або прострочено).
- **FR-03 (EAN-13 Barcode Lookup):** Сканування штрих-коду камери або ручне введення EAN-13 з отриманням назви, бренду та КБЖВ на 100г з локальної бази або зовнішнього провайдера (Open Food Facts) через захищений singleflight-кеш.
- **FR-04 (Daily Macro Targets Setup):** Встановлення та коригування цільових значень калорій, білків, жирів, вуглеводів користувача.
- **FR-05 (Meal Intake Logging):** Логування вживання страв або окремих продуктів із зазначенням ваги порції та автоматичним підрахунком нутрієнтів. Захист від повторних запитів через `Idempotency-Key`.
- **FR-06 (Macro Budget Visualization):** Візуалізація прогресу споживання (Macro Ring / Progress Bars) з розрахунком залишку добової норми.
- **FR-07 (Smart Recipe Recommendation Engine):** Алгоритм ранжування рецептів за формулою:
  $$\text{Score} = w_1 \cdot \text{ExpiringStockMatch} + w_2 \cdot \text{MacroBudgetFit} - w_3 \cdot \text{MissingIngredientsCount}$$
  де перевага надається стравам з продуктів, термін придатності яких спливає найшвидше.
- **FR-08 (Atomic 1-Click Cook Execution):** Виконання приготування страви: атомарна транзакція в БД, що списує потрібну кількість інгредієнтів за принципом FEFO з інвентарю та створює запис у журналі споживання (`MealLog`).
- **FR-09 (Household Multi-User Access & RBAC):** Створення сім'ї/домогосподарства, запрошення учасників за кодом, розподіл ролей (`Owner` — повні права, `Member` — читання/редагування інвентарю та списку покупок).
- **FR-10 (Automated Shopping List Generation):** Автоматичне додавання продукту до списку покупок при зниженні залишку нижче порогового значення або при нестачі інгредієнта для вибраного рецепта.
- **FR-11 (Proactive Expiration Alerts):** Генерація сповіщень для домогосподарства про продукти, термін придатності яких спливає через 48 та 24 години.
- **FR-12 (Offline-First Shopping List Sync):** Можливість локального відмічання куплених товарів у фронтенді з подальшою синхронізацією через вектор версій або `last_modified_at` при відновленні мережі.

### 2.3 Нефункціональні вимоги (NFR-01 — NFR-06)
- **NFR-01 (Latency):** Час відгуку API ($p95$) для операцій CRUD інвентарю та логування їжі не перевищує $150\text{ ms}$. Час генерації рекомендацій рецептів ($p95$) не перевищує $800\text{ ms}$.
- **NFR-02 (Strict Consistency & Non-Negative Inventory):** Складські залишки не можуть набувати від'ємних значень. Конкурентні списання одного й того самого продукту мають завершуватися або коректним послідовним списанням, або поверненням помилки конфлікту `409 Conflict` / `422 Unprocessable Content`.
- **NFR-03 (Resiliency & Circuit Breaker):** Зовнішні виклики до сервісів штрих-кодів захищені патерном Circuit Breaker (Polly / .NET Resilience) з fallback на локальний кеш. При збої зовнішнього API час відповіді не повинен перевищувати $500\text{ ms}$.
- **NFR-04 (Security & Multi-Tenancy):** Аутентифікація на основі Stateless JWT (Access + Refresh tokens). Строга ізоляція домогосподарств (Household-level tenant scoping): жоден користувач не має доступу до запасів чужого домогосподарства. Захист чутливих мутацій лімітами Rate Limiting.
- **NFR-05 (Observability):** Наскрізна трасування запитів через `traceparent` (W3C TraceContext) та OpenTelemetry. Експорт структурованих логів у форматі JSON. Метрики Prometheus (`http_requests_total`, `http_request_duration_seconds`, `inventory_concurrency_conflicts_total`).
- **NFR-06 (Portability & Containerization):** Всі сервіси (API, Web UI, PostgreSQL, Redis, Prometheus) запускаються однією командою через Docker Compose без ручного налаштування хост-системи.

---

## 3. Concurrency & Distributed Systems Patterns

Детально документуються у `docs/Ediens_SRS/06-concurrency-patterns.md` з використанням Mermaid `sequenceDiagram` та WebSequenceDiagrams.

### Pattern 1: Optimistic Concurrency Control (ETag / PostgreSQL `xmin`)
- **Сценарій:** Два співмешканці одночасно беруть молоко з холодильника (початковий залишок 1000 мл). Перший списує 400 мл, другий списує 700 мл.
- **Механізм:** Запит `GET /api/v1/inventory/items/{id}` повертає заголовок `ETag: W/"10423"`, сформований на основі системного поля PostgreSQL `xmin` (або `concurrency_token` UUID). При оновленні клієнт передає заголовок `If-Match: W/"10423"`.
- **Обробка:** Якщо рядок було змінено іншою транзакцією, токен не співпадає $\rightarrow$ API повертає HTTP `409 Conflict` з типом `ProblemDetails` (`CONCURRENT_MODIFICATION`). Клієнт отримує актуальний стан та показує користувачеві діалог розв'язання конфлікту.

### Pattern 2: Idempotency-Key + Distributed Redis Lock for 1-Click Cook
- **Сценарій:** Користувач натискає «Cook Recipe». Мережеве з'єднання нестабільне, браузер надсилає повторний запит через таймаут.
- **Механізм:** Клієнт генерує заголовок `Idempotency-Key: <UUIDv7>`.
- **Обробка:** API перевіряє наявність ключа в Redis/PostgreSQL (`idempotency_records`). Якщо запит виконується прямо зараз — накладається короткоживучий розподілений лок Redis (`SET lock:cook:{id} {token} NX PX 5000`). Повторний запит очікує завершення або повертає вже збережений результат без повторного списання продуктів та макросів.

### Pattern 3: Transactional Outbox + Competing Consumers (`FOR UPDATE SKIP LOCKED`)
- **Сценарій:** Після масового завантаження чеку або продуктів необхідно асинхронно оновити рекомендації рецептів без блокування відповіді користувачеві.
- **Механізм:** У тій же транзакції, де зберігаються продукти, створюється запис у таблиці `outbox_messages` (`event_type: "InventoryBatchesCreated"`).
- **Обробка:** Фоновий воркер вичитує події пачками за допомогою `SELECT * FROM outbox_messages WHERE status = 'PENDING' ORDER BY created_at LIMIT 10 FOR UPDATE SKIP LOCKED`. Це гарантує масштабованість на декілька інстансів без блокувань та гонок.

### Pattern 4: Pessimistic Row Locking (`SELECT ... FOR UPDATE`) для ліміту макро-бюджету
- **Сценарій:** Користувач із двох пристроїв одночасно логує два прийоми їжі за умови встановленого ліміту калорій на день.
- **Механізм:** Транзакція блокує рядок добового агрегату користувача: `SELECT * FROM daily_macro_logs WHERE user_id = @UserId AND log_date = @Date FOR UPDATE`.
- **Обробка:** Підсумовуються поточні калорії з новими. Якщо перевищено критичний поріг (у разі режиму суворого ліміту), транзакція відкочується з помилкою `422 DOMAIN_INVARIANT_VIOLATION`.

### Pattern 5: HybridCache Stampede Protection (Singleflight) + Sliding Window Rate Limiting
- **Сценарій:** Сплеск одночасних запитів на сканування штрих-коду або пошук рецептів з ШІ.
- **Механізм:** Використання нового `.NET HybridCache` (L1 in-memory + L2 distributed Redis) з вбудованим механізмом Singleflight/Locking: лише один запит іде до зовнішнього API Open Food Facts або моделі рекомендацій, інші паралельні потоки очікують завершення першого запиту та отримують закешований результат.
- **Rate Limiting:** Вбудований у .NET `SlidingWindowRateLimiter` обмежує клієнтів (наприклад, не більше 60 запитів на хвилину на одного користувача/IP), повертаючи `429 Too Many Requests` із заголовком `Retry-After: <seconds>`.

---

## 4. OpenAPI 3.1 & RFC 9457 Error Standards

### 4.1 Мінімальний перелік з 10 обов'язкових ендпоінтів
1. `POST /api/v1/inventory/items` — Додати партію продукту в інвентар домогосподарства.
2. `GET /api/v1/inventory/items` — Отримати перелік запасів з фільтрацією за локацією (`Fridge`, `Freezer`, `Pantry`) та сортуванням FEFO.
3. `PATCH /api/v1/inventory/items/{id}` — Спожити частину партії або змінити кількість (підтримує заголовок `If-Match: <ETag>`).
4. `DELETE /api/v1/inventory/items/{id}` — Видалити партію (зіпсована/викинута або помилково внесена).
5. `POST /api/v1/meals/log` — Залогувати прийом їжі з підтримкою заголовка `Idempotency-Key: <UUID>`.
6. `PUT /api/v1/nutrition/targets` — Встановити цільовий профіль КБЖВ користувача.
7. `GET /api/v1/recipes/recommendations` — Отримати список рекомендованих рецептів на основі продуктів, що спливають, та залишку макросів.
8. `POST /api/v1/recipes/{id}/cook` — Атомарно списати інгредієнти страви зі складу та внести макроси в журнал споживання.
9. `GET /api/v1/products/barcode/{code}` — Пошук продукту та харчової цінності за штрих-кодом EAN-13.
10. `POST /api/v1/households/{id}/shopping-list/sync` — Синхронізувати та злити зміни спільного списку покупок домогосподарства.

### 4.2 RFC 9457 Problem Details Schema
Всі помилки API повертаються у стандартному форматі `application/problem+json`:
```json
{
  "type": "https://ediens.app/errors/concurrent-modification",
  "title": "Conflict during state modification",
  "status": 409,
  "detail": "The inventory item has been modified by another household member since you loaded it.",
  "instance": "/api/v1/inventory/items/0192e2b3-5730-7432-8411-cf0b91d23456",
  "errorCode": "CONCURRENT_MODIFICATION",
  "traceId": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
  "extensions": {
    "currentETag": "W/\"10424\"",
    "currentQuantity": 600,
    "unit": "ml"
  }
}
```

### 4.3 Матриця помилок та правила клієнтської реакції (Client Reaction Rules)
| HTTP Код | Error Code | Причина виникнення | Реакція клієнта (React Web App) |
| :--- | :--- | :--- | :--- |
| **`400 Bad Request`** | `VALIDATION_FAILED` | Некоректні вхідні дані (від'ємна вага, некоректний EAN-13). | Підсвічування конкретних полів форми червоним кольором, вивід тексту помилок валідації біля відповідних інпутів. |
| **`403 Forbidden`** | `HOUSEHOLD_ACCESS_DENIED` | Спроба доступу до запасів домогосподарства, членом якого користувач не є. | Відображення екрану блокування доступу з можливістю переключити активне домогосподарство. |
| **`404 Not Found`** | `ITEM_NOT_FOUND` | Запитуваної партії продукту або рецепту не існує (або вже видалено). | Видалення елемента з локального UI-кешу, сповіщення Toast: «Продукт уже був видалений іншим учасником». |
| **`409 Conflict`** | `CONCURRENT_MODIFICATION` | Порушення ETag (`If-Match`) при одночасному списанні або зміні продукту. | Відкриття модального вікна `<ConflictResolutionModal>`: показ поточного залишку на сервері та вибір (прийняти новий залишок / скоригувати). |
| **`422 Unprocessable Content`** | `INSUFFICIENT_INVENTORY` | Спроба списати більше, ніж є в наявності при 1-Click Cook або ручному списанні. | Модальне вікно з пропозицією додати відсутні інгредієнти у список покупок або скорегувати кількість порцій. |
| **`429 Too Many Requests`** | `RATE_LIMIT_EXCEEDED` | Перевищено ліміт запитів (наприклад, сканування або ШІ-рекомендації). | Відображення банера `<RateLimitBanner>` з інтерактивним зворотним відліком таймера на основі заголовка `Retry-After`. Блокування кнопок на період очікування. |

---

## 5. Technology Stack & Coding Standards

### 5.1 Backend (.NET 10 Web API / C# 13)
- **Framework:** .NET 10 (Target: `net10.0`), C# 13 Minimal API та Vertical Slice Architecture.
- **ORM:** Entity Framework Core 10 (`Npgsql.EntityFrameworkCore.PostgreSQL`).
- **Concurrency Token:** Використання PostgreSQL системного стовпця `xmin` через маппінг `.IsRowVersion()`.
- **Caching:** .NET 10 `HybridCache` з Redis L2 backplane.
- **Resilience:** `Microsoft.Extensions.Resilience` (Retry, Timeout, Circuit Breaker).
- **Error Handling:** RFC 9457 `ProblemDetails` з кастомним `IProblemDetailsService` / ExceptionHandlerMiddleware.

### 5.2 Frontend (React 19 + TypeScript + Vite + Tailwind CSS)
- **Runtime & Build:** Vite 6+, React 19, TypeScript 5.6+.
- **Стилізація:** Tailwind CSS 3.4+ з розширеною палітрою ElevenLabs-стилю (монохромні нейтральні відтінки Zinc/Slate, акцентні кольори для макросів).
- **Компонентна естетика (ElevenLabs Design System):**
  - Темна/світла нейтральна естетика: мінімалістичні бордери `border-zinc-800`, фон `bg-zinc-950`/`bg-zinc-900`.
  - Шрифти: Inter для інтерфейсу, Geist Mono / JetBrains Mono для числових значень КБЖВ та таймерів.
  - Анімації: Мікро-інтеракції через Framer Motion / CSS transitions (плавний скейл кнопок при натисканні, пульсація лоадерів).
  - Готові компоненти у `src/ediens-web/src/components/ui/`:
    - `<Button variant="default|outline|ghost|danger">`
    - `<Card>`
    - `<Badge variant="fefo-fresh|fefo-warning|fefo-expired">`
    - `<MacroProgressRing protein={...} fat={...} carbs={...} calories={...}>`
    - `<InventoryBatchRow>`
    - `<ConflictResolutionModal>`
    - `<RateLimitBanner retryAfterSeconds={...}>`

### 5.3 PostgreSQL Database Schema Details
Таблиці, що мають бути реалізовані у TASK-01/TASK-04:
- `users`: ID, email, password_hash, created_at.
- `households`: ID, name, created_at.
- `household_members`: household_id, user_id, role (`Owner`, `Member`).
- `products`: ID, name, barcode (EAN-13, nullable), brand, calories_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g.
- `inventory_items`: ID, household_id, product_id, location (`Fridge`, `Freezer`, `Pantry`), quantity, unit, expires_at, opened_at, `xmin` (RowVersion).
- `nutrition_targets`: ID, user_id, target_calories, target_protein, target_fat, target_carbs, effective_from.
- `meal_logs`: ID, user_id, logged_at, meal_type (`Breakfast`, `Lunch`, `Dinner`, `Snack`), calories, protein, fat, carbs, idempotency_key.
- `meal_log_items`: ID, meal_log_id, product_id, quantity, unit.
- `recipes`: ID, title, description, instructions, total_calories, total_protein, total_fat, total_carbs, prep_time_minutes.
- `recipe_ingredients`: ID, recipe_id, product_id, quantity, unit.
- `shopping_list_items`: ID, household_id, product_name, quantity, unit, is_purchased, added_by_user_id, updated_at.
- `outbox_messages`: ID, event_type, payload (JSONB), status (`PENDING`, `PROCESSED`, `FAILED`), created_at, processed_at.
- `idempotency_records`: idempotency_key (PK), request_path, status_code, response_body, created_at.
