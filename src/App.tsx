import { useEffect } from 'react'
import { useGame } from './store/gameStore'
import { AboutScreen, MainMenu, NewGame, SettingsScreen } from './ui/screens/Menus'
import { LeaderboardScreen } from './ui/screens/Leaderboard'
import { NewsScreen } from './ui/screens/News'
import { PwaPrompt } from './ui/pwa/PwaPrompt'
import { CookieBar } from './ui/consent/CookieBar'
import { CrashBoundary } from './ui/screens/CrashScreen'
import { Shell } from './ui/screens/Shell'
import { installMusic } from './ui/music/player'

export default function App() {
  const screen = useGame((s) => s.screen)
  const game = useGame((s) => s.game)
  const theme = useGame((s) => s.settings.theme)
  const reducedMotion = useGame((s) => s.settings.reducedMotion)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.dataset.motion = reducedMotion ? 'reduced' : 'full'
  }, [theme, reducedMotion])

  useEffect(() => installMusic(), [])

  return (
    <>
      <CrashBoundary>
        {screen === 'game' && game ? (
          <Shell />
        ) : screen === 'newGame' ? (
          <NewGame />
        ) : screen === 'settings' ? (
          <SettingsScreen />
        ) : screen === 'about' ? (
          <AboutScreen />
        ) : screen === 'news' ? (
          <NewsScreen />
        ) : screen === 'leaderboard' ? (
          <LeaderboardScreen />
        ) : (
          <MainMenu />
        )}
      </CrashBoundary>
      <PwaPrompt />
      {screen !== 'about' && <CookieBar />}
    </>
  )
}
