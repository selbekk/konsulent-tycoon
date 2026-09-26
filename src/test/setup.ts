import '@testing-library/jest-dom/vitest'
import { clock } from '../ui/eggs/clock'

// An ordinary weekday afternoon, so the night and Christmas easter eggs stay out of unrelated tests.
clock.now = () => new Date(2026, 5, 17, 14, 0).getTime()
