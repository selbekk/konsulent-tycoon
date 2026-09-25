import { FEATURE_LEVEL } from '../engine'
import type { Feature } from '../engine'
import { TABS } from '../store/gameStore'
import type { Tab } from '../store/gameStore'

/** Tabs that only show up once the firm reaches the level for them. */
const TAB_FEATURE: Partial<Record<Tab, Feature>> = { culture: 'culture', strategy: 'strategy', backroom: 'backroom' }

export const visibleTabs = (level: number) => TABS.filter((id) => !TAB_FEATURE[id] || level >= FEATURE_LEVEL[TAB_FEATURE[id]])
