import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { track } from '../../analytics'
import { deleteSlot } from '../../engine'
import { useGame } from '../../store/gameStore'
import { Button, Panel } from '../components/ui'
import m from './menu.module.css'
import s from './screens.module.css'

function CrashScreen({ onReset }: { onReset: () => void }) {
  const { t } = useTranslation()
  const toMenu = () => {
    useGame.getState().quit()
    onReset()
  }
  // A save that crashes the game every time it's opened would otherwise trap the player.
  const deleteSave = () => {
    if (!window.confirm(t('crash.confirmDelete'))) return
    try {
      deleteSlot(localStorage, 'auto')
    } catch {
      /* no storage, nothing to delete */
    }
    toMenu()
  }
  return (
    <div className={m.wrap}>
      <div className={m.menu}>
        <Panel title={t('crash.title')} icon="warn">
          <div className={s.stack}>
            <p>{t('crash.body')}</p>
            <div className={s.row}>
              <Button variant="primary" onClick={toMenu}>
                {t('crash.menu')}
              </Button>
              <Button variant="ghost" onClick={deleteSave}>
                {t('crash.deleteSave')}
              </Button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}

/** Catches render errors (a broken or hand-edited save, a bug) so the player gets a way back instead of a blank page. */
export class CrashBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false }

  static getDerivedStateFromError() {
    return { crashed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Only the error's type: the message could contain text from the save.
    track('app_crashed', { error: error.name })
    console.error(error, info.componentStack)
  }

  render() {
    return this.state.crashed ? <CrashScreen onReset={() => this.setState({ crashed: false })} /> : this.props.children
  }
}
