import * as React from "react"

const MOBILE_BREAKPOINT = 768
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

/**
 * matchMedia is an external store, so it is read with useSyncExternalStore
 * rather than useEffect + setState: no cascading render, and the very first
 * client render already has the correct value.
 */
function subscribe(onStoreChange: () => void) {
  const mql = window.matchMedia(MOBILE_QUERY)
  mql.addEventListener("change", onStoreChange)
  return () => mql.removeEventListener("change", onStoreChange)
}

function getSnapshot() {
  return window.matchMedia(MOBILE_QUERY).matches
}

/** There is no viewport on the server; assume desktop and let the client correct it. */
function getServerSnapshot() {
  return false
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
