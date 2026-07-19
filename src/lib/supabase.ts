import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.warn(
    'WishesWorld: задайте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в .env',
  )
}

export const supabase = createClient(url ?? '', anonKey ?? '')

export function guestStorageKey(wishlistId: string) {
  return `ww_guest_${wishlistId}`
}

export function makeSlug(length = 8): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

export function makeSessionToken(): string {
  return crypto.randomUUID()
}
