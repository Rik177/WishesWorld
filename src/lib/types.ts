export type WishlistMode = 'items' | 'link'

export interface Wishlist {
  id: string
  owner_id: string
  title: string
  slug: string
  mode: WishlistMode
  cart_url: string | null
  created_at: string
}

export interface WishlistItem {
  id: string
  wishlist_id: string
  title: string
  url: string | null
  sort_order: number
}

export interface Guest {
  id: string
  wishlist_id: string
  emoji: string
  session_token: string
  created_at: string
}

export interface Claim {
  id: string
  item_id: string
  guest_id: string
  confirmed_at: string
  guest?: Pick<Guest, 'emoji'>
}

export interface ManualClaim {
  id: string
  wishlist_id: string
  guest_id: string
  title: string
  confirmed_at: string
  guest?: Pick<Guest, 'emoji'>
}

export interface PublicClaimView {
  item_id: string | null
  manual_claim_id: string | null
  title: string
  emoji: string
  guest_id: string
  is_mine: boolean
}

export interface DraftItem {
  title: string
  url: string
}

export const EMOJI_POOL = [
  '🌟', '🎁', '🎈', '🦄', '🦊', '🐱', '🐶', '🐼',
  '🦋', '🌙', '☀️', '🌈', '🍀', '🌸', '🍭', '🎯',
  '🚀', '🎮', '📚', '🎵', '💎', '🔥', '❄️', '🪐',
] as const
