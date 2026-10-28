import type { ServiceItem } from '../../../shared/types'

/** What the slide strip shows: a service item, or a song/passage opened from the library. */
export type Selection =
  | { source: 'service'; itemId: string }
  | { source: 'song'; songId: string; item: ServiceItem }
  | { source: 'bible'; item: ServiceItem }

/** A copy with ids unique to this service entry, so the same song can appear twice. */
export function freshCopy(item: ServiceItem): ServiceItem {
  const id = `${item.id}-${Date.now().toString(36)}`
  return { ...item, id, slides: item.slides.map((s, n) => ({ ...s, id: `${id}-${n + 1}` })) }
}
