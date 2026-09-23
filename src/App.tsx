import { useEffect } from 'react'
import { useGame } from './store/gameStore'
import { AboutScreen, LoadScreen, MainMenu, NewGame, SettingsScreen } from './ui/screens/Menus'
import { PwaPrompt } from './ui/pwa/PwaPrompt'
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

  return (
    <>
      {screen === 'game' && game ? (
        <Shell />
      ) : screen === 'newGame' ? (
        <NewGame />
      ) : screen === 'load' ? (
        <LoadScreen />
      ) : screen === 'settings' ? (
        <SettingsScreen />
      ) : screen === 'about' ? (
        <AboutScreen />
      ) : (
        <MainMenu />
      )}
      <PwaPrompt />
    </>
  )
}
