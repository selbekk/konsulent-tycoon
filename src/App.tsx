import { useEffect } from 'react'
import { useGame } from './store/gameStore'
import { LoadScreen, MainMenu, NewGame, SettingsScreen } from './ui/screens/Menus'
import { Shell } from './ui/screens/Shell'

export default function App() {
  const screen = useGame((s) => s.screen)
  const game = useGame((s) => s.game)
  const theme = useGame((s) => s.settings.theme)
  const reducedMotion = useGame((s) => s.settings.reducedMotion)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.dataset.motion = reducedMotion ? 'reduced' : 'full'
  }, [theme, reducedMotion])

  if (screen === 'game' && game) return <Shell />
  if (screen === 'newGame') return <NewGame />
  if (screen === 'load') return <LoadScreen />
  if (screen === 'settings') return <SettingsScreen />
  return <MainMenu />
}
