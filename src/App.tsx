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
import { isChristmasSeason } from './ui/eggs/clock'
import { PowerpointMode } from './ui/eggs/PowerpointMode'

export default function App() {
  const screen = useGame((s) => s.screen)
  const game = useGame((s) => s.game)
  const theme = useGame((s) => s.settings.theme)
  const reducedMotion = useGame((s) => s.settings.reducedMotion)
  const weeklyWeek = useGame((s) => (s.screen === 'game' ? s.game?.weekly?.week : undefined))
  const christmas = isChristmasSeason(weeklyWeek)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.dataset.motion = reducedMotion ? 'reduced' : 'full'
  }, [theme, reducedMotion])

  useEffect(() => {
    if (christmas) document.documentElement.dataset.season = 'christmas'
    else delete document.documentElement.dataset.season
  }, [christmas])

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
      <PowerpointMode />
      <PwaPrompt />
      {screen !== 'about' && <CookieBar />}
    </>
  )
}
