# 10. Модель розгортання та інфраструктури (Deployment & Infrastructure Model)

> **Статус:** Офіційний реліз розширеної інженерної специфікації (Baseline)  
> **Версія:** 2.0.0  
> **Модуль SRS:** Розділ 10 (Deployment, Cloud/Self-Hosted Topology, Network Segmentation & Sizing)  
> **Зв'язок із завданнями:** DOC-02, TASK-02, NFR-06  
> **Стандарти:** AWS Well-Architected Framework, CIS Docker Benchmark v1.6, 12-Factor App Methodology, Docker Compose v2 Specification

---

## 1. Архітектурні принципи та топологія розгортання

Модель розгортання системи **ēdiens** спроектована для забезпечення високої доступності (**High Availability**), надійної ізоляції середовищ (**Network Segmentation**) та абсолютної повторюваності інфраструктури (**Infrastructure as Code / Containerization**).

Архітектура підтримує гібридну модель експлуатації:
1. **Self-Hosted / Private Cloud Deployment:** Розгортання на виділеному сервері (Dedicated Bare-Metal / Cloud VPS під керуванням Ubuntu 24.04 LTS) з повною контейнеризацією через Docker Compose v2.
2. **Zero-Trust Edge & Ingress:** Зовнішній доступ кінцевих користувачів забезпечується через **Cloudflare Edge** (TLS 1.3, Web Application Firewall, DDoS Shield та зашифрований тунель Cloudflare Tunnel `cloudflared`), що дозволяє взагалі не відкривати публічні вхідні порти (0.0.0.0/0) на хост-системі.
3. **Secure Administrative & CI/CD Mesh:** Доступ інженерів, адміністраторів баз даних та раннерів GitHub Actions здійснюється через захищений оверлей **Tailscale WireGuard Mesh VPN** за принципом рольових ACL (`tag:ci`, `tag:admin`).

---

## 2. Комплексна діаграма інфраструктурної архітектури

Нижче наведено детальну діаграму інфраструктурної топології у нотації Mermaid, що ілюструє всі рівні безпеки, віртуальні мережі Docker Bridge, сховища даних та взаємодію між сервісами.

```mermaid
flowchart TB
    subgraph ExternalClients ["Зовнішні користувачі та адміністратори (External Network)"]
        BrowserUser["Користувачі (React 19 SPA)<br/>Web Browser & Mobile PWA"]
        AdminDevOps["DevOps / SRE інженери<br/>(Tailscale Client)"]
        GithubActions["GitHub Actions Runner<br/>(tag:ci Deploy Pipeline)"]
    end

    subgraph EdgeZeroTrust ["Зона 1: Edge & Zero-Trust Perimeter (Cloudflare & Tailscale)"]
        CF_DNS["Cloudflare DNS & WAF<br/>TLS 1.3 / HTTP/3 Termination"]
        CF_Tunnel["Cloudflare Tunnel Daemon<br/>(Zero Inbound Ports on Host)"]
        TailscaleNode["Tailscale WireGuard Mesh<br/>(:41641/udp, ACLs: tag:ci, tag:admin)"]
    end

    subgraph HostServer ["Хост-машина (Ubuntu 24.04 LTS / 4 vCPU, 8GB RAM, NVMe)"]
        subgraph NetPublic ["Docker Network: ediens-public-net (DMZ / Ingress Tier)"]
            Nginx["<b>ediens-web (Nginx 1.27 Alpine)</b><br/>• Static Asset Host (React 19 SPA)<br/>• Reverse Proxy /api/*<br/>• Brotli / Gzip Compression<br/>• Rate Limiting & SSL Stubs"]
        end

        subgraph NetApp ["Docker Network: ediens-app-net (Application Compute Tier)"]
            ApiReplica1["<b>ediens-api-1 (.NET 10)</b><br/>Kestrel Minimal APIs<br/>Internal Port: 8080"]
            ApiReplica2["<b>ediens-api-2 (.NET 10)</b><br/>Kestrel Minimal APIs<br/>Internal Port: 8080"]
            Worker["<b>ediens-worker (.NET 10)</b><br/>• Transactional Outbox Worker<br/>• FEFO Expiration Daemon<br/>• Macro Daily Reset Job"]
        end

        subgraph NetData ["Docker Network: ediens-data-net (Stateful Tier, internal: true)"]
            Postgres[("<b>ediens-postgres (PostgreSQL 16)</b><br/>• Primary Relational Store<br/>• xmin Concurrency<br/>• Port: 5432 (Internal only)")]
            Redis[("<b>ediens-redis (Redis 7 Alpine)</b><br/>• L2 HybridCache Backplane<br/>• Redlock Distributed Locks<br/>• Port: 6379 (Internal only)")]
        end

        subgraph NetMonitoring ["Docker Network: ediens-monitoring-net (Observability Tier)"]
            Prometheus["<b>Prometheus Server</b><br/>TSDB Storage / Scrape 15s<br/>Port: 9090"]
            Alertmanager["<b>Alertmanager</b><br/>Webhook / Telegram / Pager<br/>Port: 9093"]
            Grafana["<b>Grafana Visualizer</b><br/>Dashboards & Analytics<br/>Port: 3000"]
            BlackboxExp["<b>Blackbox Exporter</b><br/>HTTP / TCP Probes"]
            NodeExp["<b>Node / cAdvisor Exporter</b><br/>Hardware & Container Metrics"]
        end

        subgraph VolumesStore ["Постійні сховища (Host Docker Named Volumes)"]
            Vol_PG[("pgdata<br/>/var/lib/postgresql/data")]
            Vol_PG_Backup[("pgbackup<br/>/backups/postgres")]
            Vol_Redis[("redisdata<br/>/data")]
            Vol_Prom[("promdata<br/>/prometheus")]
            Vol_Graf[("grafdata<br/>/var/lib/grafana")]
        end
    end

    %% Зовнішні з'єднання
    BrowserUser -->|HTTPS :443 (TLS 1.3)| CF_DNS
    CF_DNS -->|Encrypted Tunnel Stream| CF_Tunnel
    CF_Tunnel -->|HTTP :80| Nginx

    AdminDevOps -->|Encrypted WireGuard Mesh| TailscaleNode
    GithubActions -->|SSH / Deploy Hooks over Mesh| TailscaleNode
    TailscaleNode -.->|Secure Localhost Access| Nginx
    TailscaleNode -.->|Direct Admin Access :5432 / :9090| Postgres

    %% Трафік DMZ -> App
    Nginx -->|Proxy Round-Robin :8080| ApiReplica1
    Nginx -->|Proxy Round-Robin :8080| ApiReplica2

    %% App -> Data
    ApiReplica1 -->|Npgsql Pool (TCP/5432)| Postgres
    ApiReplica2 -->|Npgsql Pool (TCP/5432)| Postgres
    ApiReplica1 -->|StackExchange.Redis (TCP/6379)| Redis
    ApiReplica2 -->|StackExchange.Redis (TCP/6379)| Redis

    Worker -->|SKIP LOCKED Polling (TCP/5432)| Postgres
    Worker -->|Cache Invalidation (TCP/6379)| Redis

    %% Прив'язка сховищ
    Postgres --- Vol_PG
    Postgres --- Vol_PG_Backup
    Redis --- Vol_Redis
    Prometheus --- Vol_Prom
    Grafana --- Vol_Graf

    %% Моніторинг
    Prometheus -->|Scrape /metrics| ApiReplica1
    Prometheus -->|Scrape /metrics| ApiReplica2
    Prometheus -->|Scrape /metrics| Worker
    Prometheus -->|Metrics| NodeExp
    BlackboxExp -->|Health Probes /healthz| Nginx
    Prometheus -->|Probe Targets| BlackboxExp
    Prometheus -->|Forward Alerts| Alertmanager
    Grafana -->|PromQL| Prometheus
```

> **Примітка щодо генератора діаграм:** Для автоматизованої побудови графічного файлу високої роздільної здатності (`infrastructure_diagram.png`) у проекті реалізовано скрипт на мові Python: [`scripts/generate_infra_diagram.py`](file:///Users/maxhotiuk/Documents/UNI/5yr/ediens/scripts/generate_infra_diagram.py), побудований на бібліотеці `diagrams`.

---

## 3. Детальний опис рівнів архітектури та мережевих зон

### 3.1 Edge & Zero-Trust Network Zone (Периметр безпеки)
1. **Cloudflare DNS & Edge WAF:**
   - Первинна точка входу публічного трафіку. Здійснює примусове перенаправлення HTTP $\rightarrow$ HTTPS (HSTS з параметром `preload`).
   - Фільтрація ботнетів, захист від L7 DDoS-атак та аналіз сигнатур OWASP Core Rule Set.
   - Термінація протоколів TLS 1.3 та HTTP/3 QUIC із віддачею статичних бандлів з глобальної CDN.
2. **Cloudflare Tunnel (`cloudflared`):**
   - Демон, що працює як sidecar-процес або системна служба на хості.
   - Створює вихідне зашифроване з'єднання (Outbound WebSocket / QUIC) до найближчого дата-центру Cloudflare.
   - **Критична перевага:** На хост-сервері повністю закриті вхідні публічні порти 80 та 443. Зловмисник, що сканує публічну IP-адресу сервера, бачить усі порти закритими (`filtered / closed`).
3. **Tailscale WireGuard Mesh VPN:**
   - Створює захищену peer-to-peer оверлейну мережу для обслуговування інфраструктури.
   - Раннери GitHub Actions автентифікуються за допомогою `TAILSCALE_AUTHKEY` з міткою `tag:ci` для виконання команд `docker compose up -d` без відкриття SSH-порту в інтернет.
   - Доступ до веб-панелей Grafana (:3000) та Prometheus (:9090) доступний виключно з пристроїв з міткою `tag:admin`.

---

### 3.2 Ingress / DMZ Tier (`ediens-public-net`)
1. **Контейнер `ediens-web` (Nginx 1.27 Alpine):**
   - Виконує роль високоефективного фронтенд-сервера та API Gateway.
   - **Роздача статики:** Обслуговує скомпільований бандл React 19 SPA (HTML, CSS, JS, SVG, WebP) із використанням алгоритмів стиснення **Brotli** (рівень 6) та **Gzip** (рівень 6).
   - **Маршрутизація API:** Усі запити до префіксу `/api/v1/*` проксуються до пулу бекенд-інстансів `ediens-api:8080`.
   - **Заголовки безпеки:** Nginx впроваджує повний набір CSP, HSTS, X-Content-Type-Options, X-Frame-Options та Permissions-Policy.
   - **Буферизація та ліміти:** Обмежує розмір тіла запиту (`client_max_body_size 64k;`) та запобігає Slowloris-атакам за допомогою тайм-аутів `client_body_timeout 10s;`.

---

### 3.3 Application Compute Tier (`ediens-app-net`)
1. **Контейнери `ediens-api` (.NET 10 Minimal APIs / Kestrel):**
   - Безстатусні (Stateless) контейнери застосунку, готові до горизонтального масштабування (Scale: $N$ реплік за Nginx Upstream).
   - Базовий образ: `mcr.microsoft.com/dotnet/nightly/aspnet:10.0-noble-chiseled` (мінімальний розмір ~110 МБ, нульовий вміст шеллів `bash/sh` та утиліт, максимальний захист від експлуатації вразливостей RCE).
   - Вбудована перевірка готовності та живучості:
     - `/healthz/live` — перевірка того, що Kestrel відповідає на запити;
     - `/healthz/ready` — перевірка успішного з'єднання з PostgreSQL та Redis.
2. **Контейнер `ediens-worker` (.NET 10 Background Worker):**
   - Окремий контейнер-демон для асинхронної фонової обробки.
   - **Transactional Outbox Consumer:** Раз на 1000 мс опитує таблицю `outbox_messages` за допомогою `SELECT ... FOR UPDATE SKIP LOCKED` пакетами по 50 записів, публікуючи доменні події.
   - **FEFO Alert Engine:** Щоденний сканер партій запасів із залишком терміну придатності $T \le 24$ години, що генерує сповіщення для членів домогосподарства.
   - **Idempotency Cleaner:** Очищення застарілих записів `idempotency_records` старше 24 годин.

---

### 3.4 Stateful Data & Cache Tier (`ediens-data-net`, isolated)
1. **Контейнер `ediens-postgres` (PostgreSQL 16 Alpine):**
   - Основне реляційне джерело правди.
   - Мережа `ediens-data-net` налаштована як `internal: true`, що повністю блокує вихідний та вхідний інтернет-трафік для контейнера БД. З ним можуть спілкуватися **тільки** контейнери з мереж `ediens-app-net` та `ediens-monitoring-net`.
   - **Персистентність:** Дані зберігаються у томі `pgdata` на швидкому NVMe-накопичувачі. Журнал випереджувального запису (WAL) налаштований для збереження цілісності при раптовому вимкненні живлення (`wal_level = replica`, `synchronous_commit = off` або `local`).
   - Окремий том `pgbackup` підключено для автоматичних щоденних ротаційних дампів.
2. **Контейнер `ediens-redis` (Redis 7 Alpine):**
   - Розподілений кеш другого рівня (L2) для `.NET HybridCache`, черг блокування `lock:cook:*` та лічильників `RateLimiter`.
   - Режим персистентності: **AOF (Append-Only File)** із параметром `appendfsync everysec`, що гарантує втрату не більше 1 секунди транзакцій навіть при аварії хоста.
   - Політика витіснення: `maxmemory-policy allkeys-lru` з жорстким лімітом 512 МБ пам'яті.

---

### 3.5 Observability & CI/CD Tier (`ediens-monitoring-net`)
1. **Prometheus Server:**
   - Збирає метрики (Scrape Interval: 15s) з ендпоінтів `/metrics` API, воркера, PostgreSQL Exporter та Redis Exporter.
   - Термін зберігання метрик (TSDB Retention): 30 діб у томі `promdata`.
2. **Alertmanager:**
   - Приймає сповіщення про аварії від Prometheus за правилами `alert_rules.yml`.
   - Здійснює дедуплікацію, групування та надсилання екстрених повідомлень у Telegram-чат інженерів та PagerDuty.
3. **Grafana:**
   - Візуалізація системних панелей: Golden Signals (Latency, Traffic, Errors, Saturation), FEFO Spoilage Rate, DB Locks, Cache Hit Ratio.

---

## 4. Зведена таблиця сайзингу ресурсів, портів, томів та лімітів (Infrastructure Master Sizing)

| Сервіс (Container Name) | Базовий Docker-образ | Внутрішній порт | Порт на хості (Host Binding) | CPU Request / Limit | RAM Request / Limit | Назва Docker-тому та точка монтування | Політика перезапуску (Restart) | Специфікація Healthcheck | Стратегія масштабування |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- | :---: | :--- | :---: |
| **`ediens-web`** | `nginx:1.27-alpine` | `80` (HTTP) | `127.0.0.1:80` (Cloudflare Tunnel only) | 0.1 / 0.5 ядра | 64MB / 128MB | `web_logs:/var/log/nginx` | `always` | `curl -f http://localhost/healthz \|\| exit 1` (інтервал: 10s, таймаут: 3s) | Статичний (1 репліка) |
| **`ediens-api`** | `mcr.microsoft.com/dotnet/aspnet:10.0-noble-chiseled` | `8080` (HTTP) | *Відсутній* (Тільки у bridge) | 0.5 / 1.5 ядра | 256MB / 768MB | *Бездисковий (Stateless)* | `unless-stopped` | `curl -f http://localhost:8080/healthz/ready` (інтервал: 10s, таймаут: 5s, ретраї: 3) | Горизонтальне (1..4 репліки) |
| **`ediens-worker`** | `mcr.microsoft.com/dotnet/aspnet:10.0-noble-chiseled` | *Немає* | *Відсутній* | 0.2 / 0.8 ядра | 128MB / 384MB | *Бездисковий (Stateless)* | `unless-stopped` | Внутрішній демон (перевірка через Docker process monitoring) | Синглтон (1 активний воркер) |
| **`ediens-postgres`** | `postgres:16-alpine` | `5432` | *Відсутній* (Доступ тільки з VPN) | 0.5 / 2.0 ядра | 512MB / 2048MB | `pgdata:/var/lib/postgresql/data`<br/>`pgbackup:/backups` | `always` | `pg_isready -U ediens_user -d ediens_db` (інтервал: 5s, таймаут: 3s, ретраї: 5) | Вертикальне (Primary + Read Replica) |
| **`ediens-redis`** | `redis:7-alpine` | `6379` | *Відсутній* (Внутрішня мережа) | 0.1 / 0.5 ядра | 128MB / 512MB | `redisdata:/data` | `always` | `redis-cli ping` (інтервал: 5s, таймаут: 2s, ретраї: 3) | Вертикальне (Redis Sentinel / Cluster) |
| **`ediens-prometheus`** | `prom/prometheus:v2.51.0` | `9090` | `127.0.0.1:9090` (VPN Only) | 0.2 / 0.5 ядра | 256MB / 512MB | `promdata:/prometheus` | `unless-stopped` | `wget -q --spider http://localhost:9090/-/healthy` (інтервал: 15s) | Синглтон (1 репліка) |
| **`ediens-alertmanager`** | `prom/alertmanager:v0.27.0` | `9093` | `127.0.0.1:9093` (VPN Only) | 0.05 / 0.2 ядра | 64MB / 128MB | `alertdata:/alertmanager` | `unless-stopped` | `wget -q --spider http://localhost:9093/-/healthy` | Синглтон (1 репліка) |
| **`ediens-grafana`** | `grafana/grafana:10.4.0` | `3000` | `127.0.0.1:3000` (VPN Only) | 0.1 / 0.5 ядра | 128MB / 256MB | `grafdata:/var/lib/grafana` | `unless-stopped` | `curl -f http://localhost:3000/api/health` | Синглтон (1 репліка) |

---

## 5. Процедури безперервного розгортання (Zero-Downtime Deployment)

Для оновлення версії бекенду та фронтенду без простою користувачів застосовується стратегія **Rolling Update / Blue-Green Swap** за допомогою Nginx Upstream:

```bash
#!/usr/bin/env bash
# scripts/deploy.sh — Zero-Downtime Rolling Update Script
set -euo pipefail

echo "==> [1/4] Pulling latest production images..."
docker compose pull ediens-api ediens-web

echo "==> [2/4] Scaling API to 2 replicas (Rolling start)..."
docker compose up -d --no-deps --scale ediens-api=2 --no-recreate ediens-api

echo "==> [3/4] Awaiting healthcheck readiness of new containers..."
docker compose exec ediens-api curl -f http://localhost:8080/healthz/ready

echo "==> [4/4] Reloading Nginx upstream configuration without packet drop..."
docker compose exec ediens-web nginx -s reload

echo "==> Deployment completed successfully with ZERO downtime!"
```

---

## 6. Регламент резервного копіювання та аварійного відновлення (Disaster Recovery & Backup Runbook)

### 6.1 Автоматизоване щоденне резервне копіювання бази даних (Daily Backup Cron)
Щоночі о 03:00 UTC виконується скрипт бекапу, що створює стиснутий дамп СУБД:

```bash
#!/usr/bin/env bash
# /opt/ediens/scripts/backup-db.sh
set -euo pipefail

BACKUP_DIR="/backups/postgres"
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%SZ")
BACKUP_FILE="${BACKUP_DIR}/ediens_backup_${TIMESTAMP}.sql.gz"

echo "Starting automated pg_dump for ediens_db..."
docker compose exec -T ediens-postgres pg_dump -U ediens_user -d ediens_db -F c -b -v \
  | gzip -9 > "${BACKUP_FILE}"

# Ротація: видалення копій, старших за 30 діб
find "${BACKUP_DIR}" -name "ediens_backup_*.sql.gz" -mtime +30 -delete

echo "Backup created successfully: ${BACKUP_FILE} ($(du -h "${BACKUP_FILE}" | cut -f1))"
```

### 6.2 Процедура відновлення з дампа (Restoration Runbook):
У випадку пошкодження даних або аварії хост-системи:
1. Зупинити застосунок для припинення запису:
   ```bash
   docker compose stop ediens-api ediens-worker
   ```
2. Відновити базу даних із вибраної резервної копії:
   ```bash
   gunzip -c /backups/postgres/ediens_backup_20261109_030000Z.sql.gz \
     | docker compose exec -T ediens-postgres pg_restore -U ediens_user -d ediens_db --clean --if-exists
   ```
3. Запустити API та воркер:
   ```bash
   docker compose start ediens-api ediens-worker
   ```
4. Запустити перевірочний димовий тест:
   ```bash
   ./scripts/smoke-test.sh
   ```
5. Цільові показники доступності:
   - **RTO (Recovery Time Objective):** $\le 15$ хвилин для повного підняття працездатної системи;
   - **RPO (Recovery Point Objective):** $\le 24$ години при щоденному бекапі або $\le 60$ секунд при активному архівуванні WAL.
