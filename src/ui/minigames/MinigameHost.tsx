import { useGame } from '../../store/gameStore'
import { BuzzwordBingo } from './BuzzwordBingo'
import { PresentationMeeting } from './PresentationMeeting'

export function MinigameHost() {
  const game = useGame((x) => x.game)!
  const minigame = useGame((x) => x.minigame)!
  const dispatch = useGame((x) => x.dispatch)
  const close = useGame((x) => x.openMinigame)
  const tender = game.tenders.find((t) => t.id === minigame.tenderId)
  if (!tender) return null
  const finish = (score: number) => {
    dispatch({ type: 'recordMinigame', firmId: game.playerId, tenderId: tender.id, kind: minigame.kind, score })
  }
  // Starting counts as an attempt (score 0) – reloading the page won't give a second try.
  const start = () => {
    dispatch({ type: 'recordMinigame', firmId: game.playerId, tenderId: tender.id, kind: minigame.kind, score: 0, provisional: true })
  }
  const props = { tender, firmId: game.playerId, onStart: start, onFinish: finish, onClose: () => close(null) }
  return minigame.kind === 'meeting' ? (
    <PresentationMeeting {...props} preference={game.customers[tender.customerId].meetingPreference} />
  ) : (
    <BuzzwordBingo {...props} />
  )
}
