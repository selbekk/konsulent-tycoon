import { useTranslation } from 'react-i18next'
import { firmLevel } from '../../engine'
import type { Firm } from '../../engine'
import { officeLayout } from './officeLayout'
import type { RoomTile, Tile } from './officeLayout'
import s from './office.module.css'

const SHIRTS = ['#ff9e2c', '#48d597', '#8f7bff', '#ff5c8a', '#4cc9f0', '#ffd84d']

function Desk({ occupied, i }: { occupied: boolean; i: number }) {
  const shirt = SHIRTS[i % SHIRTS.length]
  return (
    <svg viewBox="0 0 16 16" className={s.tile} shapeRendering="crispEdges" aria-hidden>
      {occupied && (
        <g className={i % 7 === 0 ? s.typing : undefined}>
          <rect x="6" y="2" width="4" height="4" fill="#f2c9a0" />
          <rect x="6" y="2" width="4" height="1" fill="#3b2f1a" />
          <rect x="5" y="6" width="6" height="4" fill={shirt} />
        </g>
      )}
      <rect x="1" y="9" width="14" height="2" fill="#8a5a2b" />
      <rect x="2" y="11" width="1" height="4" fill="#5c3a1a" />
      <rect x="13" y="11" width="1" height="4" fill="#5c3a1a" />
      <rect x="9" y="6" width="5" height="3" fill="#2b2b3a" />
      <rect x="10" y="7" width="3" height="1" fill={occupied ? '#7fe3ff' : '#44445a'} />
    </svg>
  )
}

const ROOM_ART: Record<RoomTile, React.ReactNode> = {
  coffee: (
    <>
      <rect x="4" y="5" width="8" height="9" fill="#3a3a48" />
      <rect x="5" y="6" width="6" height="3" fill="#8a8aa0" />
      <rect x="7" y="10" width="2" height="2" fill="#6b3b1a" />
      <g className="steam">
        <rect x="7" y="2" width="1" height="2" fill="#dde" />
        <rect x="9" y="1" width="1" height="2" fill="#dde" />
      </g>
    </>
  ),
  plant: (
    <>
      <rect x="5" y="11" width="6" height="4" fill="#b5651d" />
      <rect x="7" y="4" width="2" height="7" fill="#2e8b57" />
      <rect x="4" y="5" width="3" height="3" fill="#48d597" />
      <rect x="9" y="3" width="3" height="3" fill="#48d597" />
    </>
  ),
  kitchen: (
    <>
      <rect x="1" y="8" width="14" height="7" fill="#c9c9d6" />
      <rect x="2" y="9" width="5" height="5" fill="#fff" />
      <rect x="9" y="9" width="5" height="2" fill="#e85d5d" />
      <rect x="3" y="4" width="3" height="4" fill="#ffd84d" />
    </>
  ),
  sofa: (
    <>
      <rect x="1" y="7" width="14" height="5" fill="#8f7bff" />
      <rect x="1" y="5" width="2" height="7" fill="#6b58d6" />
      <rect x="13" y="5" width="2" height="7" fill="#6b58d6" />
      <rect x="2" y="12" width="1" height="2" fill="#3b2f1a" />
      <rect x="13" y="12" width="1" height="2" fill="#3b2f1a" />
    </>
  ),
  fagrom: (
    <>
      <rect x="1" y="2" width="14" height="9" fill="#2b2b3a" />
      <rect x="2" y="3" width="12" height="7" fill="#3a6ea5" />
      <rect x="3" y="5" width="6" height="1" fill="#fff" />
      <rect x="3" y="7" width="8" height="1" fill="#fff" />
      <rect x="7" y="11" width="2" height="4" fill="#2b2b3a" />
    </>
  ),
  whiteboard: (
    <>
      <rect x="1" y="2" width="14" height="10" fill="#f4f4f4" />
      <rect x="3" y="4" width="4" height="3" fill="none" stroke="#e85d5d" strokeWidth="1" />
      <rect x="8" y="5" width="5" height="1" fill="#3a6ea5" />
      <rect x="8" y="8" width="3" height="1" fill="#2e8b57" />
      <rect x="2" y="12" width="1" height="3" fill="#888" />
      <rect x="13" y="12" width="1" height="3" fill="#888" />
    </>
  ),
  pingpong: (
    <>
      <rect x="1" y="7" width="14" height="4" fill="#2e8b57" />
      <rect x="7" y="5" width="2" height="6" fill="#fff" />
      <rect x="2" y="11" width="1" height="4" fill="#555" />
      <rect x="13" y="11" width="1" height="4" fill="#555" />
      <rect x="11" y="3" width="2" height="2" fill="#fff" className="ball" />
    </>
  ),
  reception: (
    <>
      <rect x="1" y="8" width="14" height="7" fill="#8a5a2b" />
      <rect x="1" y="8" width="14" height="1" fill="#c9965a" />
      <rect x="4" y="11" width="8" height="2" fill="#ff9e2c" />
      <rect x="11" y="5" width="2" height="3" fill="#48d597" />
    </>
  ),
  window: (
    <>
      <rect x="1" y="1" width="14" height="12" fill="#2b2b3a" />
      <rect x="2" y="2" width="12" height="10" fill="#7fc8f8" />
      <rect x="3" y="7" width="3" height="5" fill="#44445a" />
      <rect x="7" y="5" width="2" height="7" fill="#44445a" />
      <rect x="10" y="8" width="4" height="4" fill="#f4f4f4" />
      <rect x="11" y="3" width="2" height="2" fill="#ffd84d" />
      <rect x="8" y="2" width="1" height="10" fill="#2b2b3a" />
    </>
  ),
  terrace: (
    <>
      <rect x="1" y="12" width="14" height="3" fill="#b5651d" />
      <rect x="2" y="7" width="3" height="5" fill="#2e8b57" />
      <rect x="1" y="5" width="5" height="3" fill="#48d597" />
      <rect x="8" y="9" width="6" height="1" fill="#ff5c8a" />
      <rect x="10" y="3" width="2" height="6" fill="#ddd" />
      <rect x="7" y="2" width="8" height="2" fill="#ff5c8a" />
    </>
  ),
  bust: (
    <>
      <rect x="4" y="12" width="8" height="3" fill="#8a8aa0" />
      <rect x="5" y="9" width="6" height="3" fill="#c9c9d6" />
      <rect x="6" y="3" width="4" height="5" fill="#e6c35c" />
      <rect x="5" y="8" width="6" height="1" fill="#e6c35c" />
      <rect x="6" y="3" width="4" height="1" fill="#b8962e" />
    </>
  ),
}

function Room({ room, label }: { room: RoomTile; label: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`${s.tile} ${s.room}`} shapeRendering="crispEdges" role="img" aria-label={label}>
      <title>{label}</title>
      {ROOM_ART[room]}
    </svg>
  )
}

export function OfficeView({ firm }: { firm: Firm }) {
  const { t } = useTranslation()
  const { floors, hiddenPeople } = officeLayout(firm)
  let deskIndex = 0
  return (
    <div className={s.office} aria-label={t('office.label')}>
      <p className={s.sign}>{t(`office.tiers.${firmLevel(firm)}`)}</p>
      {floors.map((floor, fi) => (
        <div key={fi} className={s.floor}>
          <span className={s.floorNo}>{floors.length - fi}</span>
          <div className={s.tiles}>
            {floor.tiles.map((tile: Tile, ti) =>
              tile.kind === 'desk' ? (
                <Desk key={ti} occupied={tile.occupied} i={deskIndex++} />
              ) : (
                <Room key={ti} room={tile.room} label={t(`office.rooms.${tile.room}`)} />
              ),
            )}
          </div>
        </div>
      ))}
      {hiddenPeople > 0 && <p className={s.more}>{t('office.more', { count: hiddenPeople })}</p>}
      <div className={s.walker} aria-hidden>
        <svg viewBox="0 0 8 12" shapeRendering="crispEdges">
          <rect x="2" y="0" width="4" height="4" fill="#f2c9a0" />
          <rect x="1" y="4" width="6" height="5" fill="#ff5c8a" />
          <rect x="2" y="9" width="1" height="3" fill="#2b2b3a" />
          <rect x="5" y="9" width="1" height="3" fill="#2b2b3a" />
          <rect x="6" y="5" width="2" height="2" fill="#fff" />
        </svg>
      </div>
    </div>
  )
}
