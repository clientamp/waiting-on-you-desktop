import {
  useLayoutEffect,
  useMemo,
  useState,
  type RefObject,
} from 'react'
import { combinePaneVisible } from './panelLoad'

export function useEffectivePollVisible(
  hostPaneVisible: boolean,
  rootRef: RefObject<HTMLElement | null>,
  trackDom: boolean,
): boolean {
  const [rootIntersecting, setRootIntersecting] = useState<boolean | null>(null)
  const [documentVisible, setDocumentVisible] = useState(
    () =>
      typeof document === 'undefined' ||
      document.visibilityState === 'visible',
  )

  useLayoutEffect(() => {
    if (!trackDom || typeof document === 'undefined') return
    const onVis = () =>
      setDocumentVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [trackDom])

  useLayoutEffect(() => {
    if (!trackDom) return
    const el = rootRef.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setRootIntersecting(null)
      return
    }
    const obs = new IntersectionObserver(
      entries => setRootIntersecting(entries.some(e => e.isIntersecting)),
      { threshold: 0 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [trackDom, rootRef, hostPaneVisible])

  return useMemo(
    () =>
      trackDom
        ? combinePaneVisible(
            hostPaneVisible,
            rootIntersecting,
            documentVisible,
          )
        : true,
    [trackDom, hostPaneVisible, rootIntersecting, documentVisible],
  )
}
