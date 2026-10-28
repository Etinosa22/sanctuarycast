import type { ScApi } from '../../shared/types'

declare global {
  interface Window {
    sc: ScApi
  }
}
