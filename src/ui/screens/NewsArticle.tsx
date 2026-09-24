import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { track } from '../../analytics'
import { articleKey, articleVariants } from '../../content/articles'
import { createRng, hashString, personName } from '../../engine'
import type { NewsItem } from '../../engine'
import { useGame } from '../../store/gameStore'
import { Button, Modal } from '../components/ui'
import { formatQuarter, newsText, resolveParams } from '../format'
import s from './screens.module.css'

/** A news line as a short newspaper story: headline, masthead, the ticker line as the lead, and the body. */
export function NewsArticle({ item, onClose }: { item: NewsItem; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const player = useGame((x) => x.game!.firms[x.game!.playerId].name)
  const variant = (hashString(item.id) % articleVariants(item.key)) + 1
  const key = `game:articles.${articleKey(item.key)}.${variant}`
  const params = { ...resolveParams(item.params, t, i18n.language), player }
  const lead = newsText(item, t, i18n.language)
  const has = i18n.exists(`${key}.headline`)
  const headline = has ? t(`${key}.headline`, params) : lead
  const body = has ? t(`${key}.body`, params).split('\n\n') : []
  // The reporter is made up, and the same every time for the same story.
  const reporter = personName(createRng(hashString(`reporter:${item.id}`)), 0)
  useEffect(() => track('news_article_opened', { news: item.key, personal: !!item.personal, has_story: has }), [item.key, item.personal, has])

  return (
    <Modal title={headline} icon="news" onClose={onClose} actions={<Button onClick={onClose}>{t('common.close')}</Button>}>
      <article className={s.article}>
        <p className={s.articleMasthead}>
          <span>{t('article.paper')}</span>
          <span>
            {formatQuarter(item.quarter)} · {t('article.byline', { name: reporter })}
          </span>
        </p>
        {has && <p className={s.articleLead}>{lead}</p>}
        {body.map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </article>
    </Modal>
  )
}
