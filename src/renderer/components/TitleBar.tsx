import s from './TitleBar.module.css'

export default function TitleBar() {
  const minimize = () => window.kazuki?.window.minimize()
  const maximize = () => window.kazuki?.window.maximize()
  const close = () => window.kazuki?.window.close()

  return (
    <div className={s.titlebar}>
      <div className={s.dragRegion}>
        <div className={s.title}>KAZUKI CLIENT</div>
      </div>
      <div className={s.controls}>
        <button className={s.ctrlBtn} onClick={minimize}>—</button>
        <button className={s.ctrlBtn} onClick={maximize}>□</button>
        <button className={`${s.ctrlBtn} ${s.closeBtn}`} onClick={close}>✕</button>
      </div>
    </div>
  )
}