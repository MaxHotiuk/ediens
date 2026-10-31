# Інструкція з верифікації системи (Verification Guide & E2E Checklist) — ēdiens

> **Версія:** 1.0.0  
> **Оновлено в рамках:** TASK-08  
> **Статус:** Офіційний регламент тестування та приймальної верифікації

---

## 1. Огляд та мета системи верифікації

Метою регламенту верифікації є гарантія відповідності системи всім функціональним (**FR-01 — FR-12**) та нефункціональним (**NFR-01 — NFR-06**) вимогам SRS, цілісності розподілених патернів (OCC, FEFO, Idempotency-Key, Circuit Breaker) та безпомилкової взаємодії мікросервісів у контейнерному середовищі.

Верифікація здійснюється за багаторівневою моделлю:
1. **Рівень 1 (Contracts & Foundations):** Валідація цілісності JSON-файлів черги завдань, OpenAPI 3.1 схеми та нормативної документації.
2. **Рівень 2 (Backend Compilation & Test Suite):** Компіляція .NET 8 API без попереджень та виконання повного набору тестів xUnit.
3. **Рівень 3 (Frontend Compilation & Type Safety):** Перевірка типів TypeScript та компіляція Vite production bundle.
4. **Рівень 4 (Container & Infrastructure Validation):** Перевірка синтаксису multi-container compose stacks та конфігурацій Prometheus, Grafana, Alertmanager.
5. **Рівень 5 (End-to-End Functional Scenarios):** Наскрізна перевірка критичних користувацьких та системних сценаріїв.

---

## 2. Комплексний чекліст верифікації (Verification Checklist)

| Рівень | Перевірка | Інструмент / Команда | Критерій успіху |
| :--- | :--- | :--- | :--- |
| **L1** | Валідність JSON черги завдань | `jq empty .agents/tasks/TASK-*.json` | Відсутність синтаксичних помилок |
| **L1** | Наявність обов'язкових документів | `AGENTS.md`, `KNOWLEDGE.md`, `Ediens_SRS.md`, `Ediens_OpenAPI.yaml` | Усі файли присутні |
| **L2** | Збірка бекенду | `dotnet build src/Ediens.Api` | 0 Warnings, 0 Errors |
| **L2** | Автоматизовані тести бекенду | `dotnet test src/Ediens.Tests` | 17/17 тестів пройдено успішно |
| **L3** | Збірка React 19 SPA | `cd src/ediens-web && npm run build` | Успішна збірка бандлу без помилок TS |
| **L4** | Валідація `compose.yaml` | `docker compose config` | Валідна специфікація 4 сервісів |
| **L4** | Валідація `compose.monitoring.yaml` | `docker compose -f compose.monitoring.yaml config` | Валідна специфікація Prometheus, Alertmanager, Grafana |
| **L4** | Конфігурація моніторингу | Валідність YAML правил та дашбордів | Prometheus, Alertmanager та Grafana файли валідні |
| **L5** | Наскрізний запуск перевірки | `./scripts/verify.sh` | Код завершення `0` (Verification PASSED) |

---

## 3. Покрокові сценарії наскрізної (E2E) верифікації

Після запуску стеку (`docker compose -f compose.yaml -f compose.monitoring.yaml up -d`) виконайте перевірку наступних сценаріїв через `curl` або інструменти тестування API:

### Сценарій 1: Перевірка працездатності сервісу (Health Check)
```bash
curl -i http://localhost:8080/health
```
- **Очікуваний результат:** HTTP `200 OK`, JSON `{ "status": "Healthy", "service": "Ediens.Api", "version": "1.0.0" }`.

---

### Сценарій 2: Додавання партії продукту та перевірка сортування FEFO (FR-01, FR-02)
1. **Створення партії молока з терміном придатності через 2 дні:**
```bash
curl -i -X POST http://localhost:8080/api/v1/inventory/items \
  -H "Content-Type: application/json" \
  -d '{
    "householdId": "00000000-0000-0000-0000-000000000001",
    "productId": "00000000-0000-0000-0000-000000000001",
    "location": "Fridge",
    "quantity": 1000,
    "unit": "ml",
    "expiresAt": "2026-11-02T12:00:00Z"
  }'
```
- **Очікуваний результат:** HTTP `201 Created`, тіло містить `id`, `quantity: 1000`, `expiresAt`, а також заголовок або поле `ETag`.

2. **Запит списку запасів з перевіркою FEFO:**
```bash
curl -i http://localhost:8080/api/v1/inventory/items?householdId=00000000-0000-0000-0000-000000000001
```
- **Очікуваний результат:** HTTP `200 OK`, партії автоматично відсортовані за `expiresAt ASC` (партія, що закінчується раніше, йде першою).

---

### Сценарій 3: Оптимістичне блокування (OCC) та конфлікт версій (Pattern 1, RFC 9457)
1. **Зчитування поточного стану партії продукту:**
```bash
curl -i http://localhost:8080/api/v1/inventory/items/{ITEM_ID}
```
Збережіть значення отриманого заголовка `ETag: W/"..."`.

2. **Перше успішне оновлення з передачею `If-Match`:**
```bash
curl -i -X PATCH http://localhost:8080/api/v1/inventory/items/{ITEM_ID} \
  -H "Content-Type: application/json" \
  -H "If-Match: W/\"OLD_ETAG\"" \
  -d '{"quantity": 600}'
```
- **Очікуваний результат:** HTTP `200 OK`, новий залишок `600`, оновлений `ETag`.

3. **Спроба повторного оновлення із застарілим токеном:**
```bash
curl -i -X PATCH http://localhost:8080/api/v1/inventory/items/{ITEM_ID} \
  -H "Content-Type: application/json" \
  -H "If-Match: W/\"OLD_ETAG\"" \
  -d '{"quantity": 400}'
```
- **Очікуваний результат:** HTTP `409 Conflict`, заголовок `Content-Type: application/problem+json`, тіло містить `errorCode: "CONCURRENT_MODIFICATION"`, `title`, `traceId` згідно стандарту RFC 9457.

---

### Сценарій 4: Атомарна операція 1-Click Cook з Idempotency-Key (FR-08, Pattern 2)
1. **Виконання приготування рецепту з унікальним ключем ідемпотентності:**
```bash
IDEM_KEY="11111111-2222-3333-4444-555555555555"
curl -i -X POST http://localhost:8080/api/v1/recipes/00000000-0000-0000-0000-000000000001/cook \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEM_KEY" \
  -d '{}'
```
- **Очікуваний результат:** HTTP `200 OK`, JSON із підтвердженням списання інгредієнтів за FEFO та створення запису `mealLogId`.

2. **Повторний ідентичний запит з тим самим ключем:**
```bash
curl -i -X POST http://localhost:8080/api/v1/recipes/00000000-0000-0000-0000-000000000001/cook \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEM_KEY" \
  -d '{}'
```
- **Очікуваний результат:** Повернення збереженої відповіді без повторного списання продуктів зі складу та без подвоєння калорій.

---

### Сценарій 5: Встановлення цілей КБЖВ та динамічний прогрес (FR-04, FR-06)
1. **Оновлення добових цілей:**
```bash
curl -i -X PUT http://localhost:8080/api/v1/nutrition/targets \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "00000000-0000-0000-0000-000000000001",
    "targetCalories": 2400,
    "targetProtein": 160,
    "targetFat": 70,
    "targetCarbs": 260
  }'
```
- **Очікуваний результат:** HTTP `200 OK`.

2. **Перевірка розрахунку залишку макро-бюджету:**
```bash
curl -i http://localhost:8080/api/v1/nutrition/progress?userId=00000000-0000-0000-0000-000000000001
```
- **Очікуваний результат:** JSON з полями `remainingCalories`, `remainingProtein`, `percentages`.

---

### Сценарій 6: Моніторинг, метрики Prometheus та дашборд Grafana (NFR-05)
1. **Перевірка доступності метрик бекенду:**
```bash
curl -i http://localhost:8080/metrics
```
- **Очікуваний результат:** Текстовий формат Prometheus із наявністю метрик `http_requests_total`, `http_request_duration_seconds`, `inventory_concurrency_conflicts_total`.

2. **Перевірка дашборду в Grafana:**
- Відкрийте в браузері `http://localhost:3000` (логін `admin`, пароль `admin`).
- Перейдіть у розділ **Dashboards** $\rightarrow$ **ēdiens Core** $\rightarrow$ **ēdiens Platform Overview**.
- Переконайтеся у відображенні панелей RPS, Latency p50/p95/p99, Error Rate, Outbox Lag.

---

## 4. Виконання автоматизованого скрипта верифікації

Для запуску всієї послідовності перевірок виконайте:

```bash
./scripts/verify.sh
```

Скрипт послідовно виконує 7 етапів валідації:
1. Синтаксична валідація JSON стану завдань (`TASK-*` та `FIX-*`).
2. Перевірка наявності всіх нормативних документів (SRS, OpenAPI, посібники, конфігурації контейнерів та моніторингу).
3. Anti-Kostyl Gate: статичний пошук заборонених патернів моків (`MOCK_`, `fallbackData`, `fakeApi`, ковтання помилок у `catch`).
4. Збірка бекенду .NET 8 API та виконання повного набору тестів xUnit (17/17 тестів).
5. Збірка клієнтського інтерфейсу React 19 (TypeScript компіляція `tsc -b` + Vite production bundle).
6. Валідація структури Dockerfile, Docker Compose (`compose.yaml`, `compose.monitoring.yaml`) та AST валідація YAML.
7. Валідація правил Prometheus та JSON-дашбордів Grafana.

Для наскрізного запуску разом із живими димовими тестами API використовуйте:
```bash
./scripts/verify.sh --smoke
# або із автоматичним запуском API бекенду:
AUTO_BOOT=1 ./scripts/verify.sh --smoke
```

---

## 5. Звіт про стабілізацію та прийомку (Phase 2: Zero-Fallback Stabilization)

Усі завдання другої фази стабілізації (`FIX-01` — `FIX-06`) успішно реалізовані та злиті в гілку `develop` відповідно до розподіленого протоколу блокувань Multi-PC Git Lock:

| Завдання | Опис | Статус | Результат верифікації |
| :--- | :--- | :--- | :--- |
| **FIX-01** | CORS, міграції EF Core, PostgreSQL 17+, RFC 9457 middleware | `DONE` | Міграції створені, глобальний перехоплювач винятків повертає `application/problem+json` |
| **FIX-02** | Типізований клієнт `Axios`, обробник помилок, змінні середовища | `DONE` | `ediensApi` типізований через Axios, перехоплювачі обробляють 400/403/404/409/422/429 |
| **FIX-03** | Жива інтеграція інвентарю та штрихкодів, FEFO бейджі, OCC ETag 409 | `DONE` | Реальний доступ до БД `ediens`, списання з перевіркою версії `xmin`, модальне вікно конфліктів |
| **FIX-04** | Харчування, прогрес КБЖВ, 1-Click Cook списання, обробка дефіциту 422 | `DONE` | `GET /api/v1/nutrition/progress`, `GET /api/v1/meals`, списання інгредієнтів за FEFO, 422 модалка |
| **FIX-05** | Домогосподарства, синхронізація списку покупок, offline queue LWW, OpenAPI | `DONE` | `GET /api/v1/households`, синхронізація з Last-Write-Wins, узгодження `Ediens_OpenAPI.yaml` |
| **FIX-06** | Docker Compose інтеграція, Nginx проксі, видалення залишків моків, E2E Smoke Suite | `DONE` | 31/31 димових тестів пройдено, повне видалення `mockStore.ts`, Nginx проксі з прокиданням заголовків |

### 5.1 Результати запуску E2E Smoke Test Suite (`scripts/smoke-test.sh`)

- **Перевірка базового стану:**
  - `GET /health`: HTTP 200 OK (`Healthy`)
  - `GET /api/v1/ping`: HTTP 200 OK (`pong`)
- **Позитивні тести OpenAPI маршрутів (14 ендпоінтів):**
  - `POST /api/v1/inventory/items`: HTTP 201 Created (з поверненням ETag)
  - `GET /api/v1/inventory/items?householdId=...`: HTTP 200 OK (FEFO сортування)
  - `GET /api/v1/inventory/items/{id}`: HTTP 200 OK
  - `PATCH /api/v1/inventory/items/{id}` (з `If-Match: W/"..."`): HTTP 200 OK
  - `DELETE /api/v1/inventory/items/{id}`: HTTP 204 No Content
  - `POST /api/v1/meals/log` (з `Idempotency-Key`): HTTP 201 Created
  - `PUT /api/v1/nutrition/targets`: HTTP 200 OK
  - `GET /api/v1/nutrition/targets`: HTTP 200 OK
  - `GET /api/v1/nutrition/progress`: HTTP 200 OK
  - `GET /api/v1/meals`: HTTP 200 OK
  - `GET /api/v1/recipes/recommendations`: HTTP 200 OK
  - `GET /api/v1/products/barcode/{code}`: HTTP 200 OK
  - `GET /api/v1/households`: HTTP 200 OK
  - `POST /api/v1/households/{id}/shopping-list/sync`: HTTP 200 OK
  - `GET /api/v1/households/{id}/shopping-list`: HTTP 200 OK
  - `GET /metrics`: HTTP 200 OK (Prometheus text format)
- **Негативні контракти помилок RFC 9457:**
  - `HTTP 400`: `errorCode: VALIDATION_FAILED` (некоректна кількість та локація)
  - `HTTP 403`: `errorCode: HOUSEHOLD_ACCESS_DENIED` (міждомогосподарський доступ)
  - `HTTP 404`: `errorCode: ITEM_NOT_FOUND` (неіснуючий ідентифікатор)
  - `HTTP 409`: `errorCode: CONCURRENT_MODIFICATION` (застарілий ETag при мутації)
  - `HTTP 422`: `errorCode: INSUFFICIENT_INVENTORY` (приготування страви за браком продуктів)
  - `HTTP 429`: `errorCode: RATE_LIMIT_EXCEEDED` (перевищення ліміту частоти запитів + заголовок `Retry-After: 30`)

**Підсумок:** Платформа ēdiens повністю позбавлена штучних заглушок, мок-масивів та емуляцій помилок. Усі клієнтські операції успішно виконуються проти реальної реляційної СУБД PostgreSQL 17 та бекенду ASP.NET Core 8.

