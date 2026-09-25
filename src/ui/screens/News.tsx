import { useTranslation } from 'react-i18next'
import { useGame } from '../../store/gameStore'
import { Button, Panel } from '../components/ui'
import { NEWS_POSTS, formatPostDate } from '../news'
import m from './menu.module.css'
import s from './screens.module.css'

export function NewsScreen() {
  const { t, i18n } = useTranslation()
  const go = useGame((x) => x.go)
  const previous = useGame((x) => x.previousScreen)
  const game = useGame((x) => x.game)
  return (
    <div className={m.wrap}>
      <div className={`${m.menu} ${m.wide}`}>
        <Panel title={t('news.title')} icon="news">
          <div className={`${s.stack} ${m.about}`}>
            {NEWS_POSTS.map((post) => (
              <article key={post.id} className={m.post}>
                <h3>{t(`news.posts.${post.id}.title`)}</h3>
                <time className={`${s.small} ${s.muted}`} dateTime={post.date}>
                  {formatPostDate(post.date, i18n.language)}
                </time>
                {(t(`news.posts.${post.id}.body`, { returnObjects: true }) as string[]).map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </article>
            ))}
            <Button onClick={() => go(game && previous === 'game' ? 'game' : 'menu')}>{t('common.back')}</Button>
          </div>
        </Panel>
      </div>
    </div>
  )
}
