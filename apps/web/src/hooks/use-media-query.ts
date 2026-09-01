import { useSyncExternalStore } from "react"

const subscribe = (onChange: () => void, q: string) => {
  const mql = matchMedia(q)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

export function useMediaQuery(q: string): boolean {
  return useSyncExternalStore(
    (cb) => subscribe(cb, q),
    () => matchMedia(q).matches,
    () => true,
  )
}
