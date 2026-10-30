import type { ReadingPreferences, Story } from './types'

const createdAt = Date.now()

export const defaultPreferences: ReadingPreferences = {
  fontSize: 18,
  lineHeight: 1.75,
  theme: 'midnight',
}

export const sampleStories: Story[] = [
  {
    id: 'sample-lanterns',
    title: 'The Lantern Keeper',
    description: 'A quiet mystery from a rain-washed harbor.',
    isSample: true,
    createdAt,
    updatedAt: createdAt,
    chapters: [
      {
        id: 'sample-lanterns-chapter-1',
        title: 'The Light Beyond the Breakwater',
        createdAt,
        updatedAt: createdAt,
        paragraphs: [
          'Sample story — written to demonstrate the Midnight Library reading experience.',
          'By the time Mara reached Bellweather Harbor, the rain had polished every rooftop to a dark shine. The sea wall curved away beneath a string of amber lamps, each one trembling in the wind like a held breath.',
          'She had come for the lighthouse ledger, or so she told the ferryman. Her grandmother’s last letter was folded in her coat, its paper soft from being read too often. Find the light that burns when the tower is dark, it said.',
          'At the end of the quay stood a narrow shop with blue windows. A brass bell chimed as she entered, although the door never touched it. Inside, hundreds of lanterns hung from the rafters: ship lanterns, reading lamps, tiny paper moons, and one green glass light that seemed to hold a summer evening inside it.',
          '“You’re late,” said the keeper from behind the counter. He was an old man with silver spectacles and a cardigan patched at both elbows. “The tide has already turned.”',
          'Mara glanced back through the window. Beyond the harbor mouth, the lighthouse was a pale mark against the storm. Its great lens had not shone in eleven years.',
          '“I didn’t know anyone was expecting me.”',
          'The keeper smiled and reached beneath the counter. He brought out a small lantern, no larger than an apple. Its flame was blue and steady. “Lights remember their way home,” he said. “People sometimes need reminding.”',
          'Outside, the rain softened. One by one, the lamps along the sea wall turned toward the distant tower, as though a silent wind had moved through them.',
        ],
      },
      {
        id: 'sample-lanterns-chapter-2',
        title: 'A Map Made of Starlight',
        createdAt,
        updatedAt: createdAt,
        paragraphs: [
          'Sample story — written to demonstrate the Midnight Library reading experience.',
          'The lantern cast no light on the cobbles. Instead, it revealed a second harbor laid over the first: vanished streets, forgotten doors, and silver paths running across the surface of the sea.',
          'Mara followed one of those paths to the old customs house. In its attic she found a chart pinned beneath a compass, every coastline drawn in her grandmother’s familiar hand.',
          'Where ordinary maps marked reefs and soundings, this one named promises. A bright line connected Bellweather to a tiny island that appeared on no modern chart.',
          'At midnight, the lighthouse gave a single blue flash. Far beyond the breakwater, something answered.',
        ],
      },
    ],
  },
  {
    id: 'sample-orchard',
    title: 'When the Orchard Dreams',
    description: 'Letters, old trees, and one impossible autumn.',
    isSample: true,
    createdAt: createdAt - 86_400_000,
    updatedAt: createdAt - 86_400_000,
    chapters: [
      {
        id: 'sample-orchard-chapter-1',
        title: 'The First Red Leaf',
        createdAt,
        updatedAt: createdAt,
        paragraphs: [
          'Sample story — written to demonstrate the Midnight Library reading experience.',
          'Every September, the first red leaf landed on the kitchen step before dawn. This year it carried a sentence in gold ink: I kept the gate open for you.',
          'Nell knew the handwriting at once, though she had not seen it since she was twelve. She placed the leaf between the pages of the old orchard almanac and waited for the sun to rise.',
          'Beyond the glass, the apple trees leaned toward the house. Their branches tapped softly at the windows, patient as visitors who knew they would eventually be invited in.',
        ],
      },
    ],
  },
]
