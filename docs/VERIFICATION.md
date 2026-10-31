# Verification Guide — ēdiens

> **Статус:** Каркас інструкції верифікації системи. Повне наповнення виконується в рамках **TASK-08**.

## Перевірка працездатності (Verification Steps)
- Валідація збірки .NET бекенду (`dotnet build`, `dotnet test`)
- Валідація збірки React фронтенду (`npm run build`, `npm run lint`)
- Валідація OpenAPI специфікації
- Автоматизований скрипт перевірки: `scripts/verify.sh`
