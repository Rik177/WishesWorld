# WishesWorld

Вишлисты для друзей: создаёшь список или кидаешь ссылку на корзину, гости выбирают эмодзи и отмечают, что купят.

## Стек

- React + TypeScript + Vite
- Supabase (Auth + Postgres + RLS/RPC)

## Быстрый старт

1. Создай проект в [Supabase](https://supabase.com).
2. В SQL Editor выполни [`supabase/schema.sql`](supabase/schema.sql).
3. Скопируй `.env.example` → `.env` и подставь ключи:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

4. Установи зависимости и запусти:

```bash
npm install
npm run dev
```

В Auth настройках Supabase для друзей удобно отключить подтверждение email (Authentication → Providers → Email → Confirm email).

## Как пользоваться

- **Владелец** регистрируется и создаёт вишлист (список товаров или одна ссылка).
- **Гости** открывают `/w/<slug>`, выбирают эмодзи и бронируют подарки без аккаунта.
- У владельца брони скрыты; кнопка «Показать брони» раскрывает сюрприз.
