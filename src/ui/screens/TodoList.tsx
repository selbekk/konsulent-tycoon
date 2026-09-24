import { useTranslation } from 'react-i18next'
import { openCrises } from '../../engine'
import type { Todo, TodoId } from '../../engine'
import { useGame } from '../../store/gameStore'
import type { Tab } from '../../store/gameStore'
import { Icon } from '../components/Icon'
import { Button } from '../components/ui'
import s from './screens.module.css'

const TODO_TAB: Record<TodoId, Tab> = { crisis: 'dashboard', bid: 'tenders', pitch: 'tenders', hire: 'staff', nurture: 'contracts' }

/** Checklist of this quarter's to-dos. `onGo` runs before switching tab (e.g. to close a dialog). */
export function TodoList({ todos, onGo }: { todos: Todo[]; onGo?: () => void }) {
  const { t } = useTranslation()
  const setTab = useGame((x) => x.setTab)
  const game = useGame((x) => x.game)
  const openCrisis = useGame((x) => x.openCrisis)
  return (
    <ul className={s.todoList}>
      {todos.map((todo) => (
        <li key={todo.id} data-done={todo.done}>
          <span className={s.todoBox} aria-hidden>
            {todo.done && <Icon name="check" size={12} />}
          </span>
          <span className={s.todoText}>
            <span className={s.todoLabel}>
              <span className="visually-hidden">{todo.done ? t('todo.doneSr') : t('todo.openSr')} </span>
              {t(`todo.items.${todo.id}.label`)}
            </span>
            {!todo.done && <span className={`${s.small} ${s.muted}`}>{t(`todo.items.${todo.id}.detail`, todo.params)}</span>}
          </span>
          {!todo.done && (
            <Button
              size="small"
              onClick={() => {
                onGo?.()
                setTab(TODO_TAB[todo.id])
                // The crisis to-do opens the decision itself, not just the tab.
                const crisis = todo.id === 'crisis' && game ? openCrises(game, game.playerId)[0] : undefined
                if (crisis) openCrisis(crisis.id)
              }}
            >
              {t(`todo.items.${todo.id}.go`)}
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}
