import type { IconName } from '../components/Icon'

/** The three parts of Project 7, in the order a student should visit them. */
export const PARTS = [
  {
    id: 'rounds',
    num: 1,
    label: 'Rounds',
    title: 'AES rounds, step by step',
    icon: 'layers',
    summary: 'Pause after every operation of a round, then run the full encryption or decryption with the key and data after each round.',
  },
  {
    id: 'avalanche',
    num: 2,
    label: 'Avalanche',
    title: 'The avalanche effect',
    icon: 'zap',
    summary: 'Change one bit of the data or the key and count how many bits differ after every round.',
  },
  {
    id: 'keys',
    num: 3,
    label: 'Key expansion',
    title: 'Key expansion',
    icon: 'key',
    summary: 'Turn one 128-bit key into 44 words, grouped into the 11 round keys K0 … K10.',
  },
] as const satisfies readonly { id: string; num: number; label: string; title: string; icon: IconName; summary: string }[]

export type PartId = (typeof PARTS)[number]['id']
