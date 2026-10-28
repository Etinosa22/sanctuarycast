// Starter running order so the console has something to show before the song
// library (Step 6) and Bible search (Step 5) exist. Public-domain text only:
// KJV scripture and hymns from 1779 and 1826.

import type { ServiceItem, ServiceState, Slide, SlideKind, SongInput } from '../../shared/types'

function item(id: string, kind: SlideKind, title: string, slides: Omit<Slide, 'id' | 'kind'>[]): ServiceItem {
  return { id, kind, title, slides: slides.map((s, n) => ({ ...s, id: `${id}-${n + 1}`, kind })) }
}

/** Starter songs for an empty library, rebuilt from the demo service's song items. */
export function demoSongs(): SongInput[] {
  return demoService()
    .items.filter((i) => i.kind === 'song')
    .map((i) => {
      const sections = i.slides.map((s) => ({ label: s.section ?? 'V1', text: s.text }))
      return {
        title: i.title,
        author: i.id === 'amazing-grace' ? 'John Newton (1779)' : 'Reginald Heber (1826)',
        ccli: '',
        sections,
        arrangement: sections.map((s) => s.label)
      }
    })
}

export function demoService(): ServiceState {
  return {
    rev: 0,
    title: 'Sunday Service',
    items: [
      item('welcome', 'announcement', 'Welcome', [
        { section: '1', text: 'Welcome to Sunday Service' },
        { section: '2', text: 'Please silence your phones\nWe begin in a few minutes' }
      ]),
      item('holy-holy-holy', 'song', 'Holy, Holy, Holy', [
        {
          section: 'V1',
          text: 'Holy, holy, holy! Lord God Almighty!\nEarly in the morning our song shall rise to Thee;\nHoly, holy, holy, merciful and mighty!\nGod in three Persons, blessed Trinity!'
        }
      ]),
      item('amazing-grace', 'song', 'Amazing Grace', [
        { section: 'V1', text: 'Amazing grace! How sweet the sound\nThat saved a wretch like me!\nI once was lost, but now am found;\nWas blind, but now I see.' },
        { section: 'V2', text: "'Twas grace that taught my heart to fear,\nAnd grace my fears relieved;\nHow precious did that grace appear\nThe hour I first believed!" },
        { section: 'V3', text: "Through many dangers, toils and snares,\nI have already come;\n'Tis grace hath brought me safe thus far,\nAnd grace will lead me home." }
      ]),
      item('psalm-23', 'scripture', 'Psalm 23:1–6 (KJV)', [
        {
          section: '1–2',
          label: 'Psalm 23:1–2 (KJV)',
          text: 'The LORD is my shepherd; I shall not want.\nHe maketh me to lie down in green pastures: he leadeth me beside the still waters.'
        },
        {
          section: '3–4',
          label: 'Psalm 23:3–4 (KJV)',
          text: "He restoreth my soul: he leadeth me in the paths of righteousness for his name's sake.\nYea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me."
        },
        {
          section: '5–6',
          label: 'Psalm 23:5–6 (KJV)',
          text: 'Thou preparest a table before me in the presence of mine enemies: thou anointest my head with oil; my cup runneth over.\nSurely goodness and mercy shall follow me all the days of my life: and I will dwell in the house of the LORD for ever.'
        }
      ]),
      item('john-3-16', 'scripture', 'John 3:16–17 (KJV)', [
        {
          section: '3:16',
          label: 'John 3:16 (KJV)',
          text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.'
        },
        {
          section: '3:17',
          label: 'John 3:17 (KJV)',
          text: 'For God sent not his Son into the world to condemn the world; but that the world through him might be saved.'
        }
      ])
    ]
  }
}
