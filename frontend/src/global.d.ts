export {}

declare global {
  function __(text: string): string

  interface String {
    format(...args: any[]): string
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    __: (text: string) => string
  }
}

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    __: (text: string) => string
  }
}

// frappe-ui ships `useTelemetry` at runtime (frappe-ui/frappe/index.js) but its
// bundled index.d.ts omits it. Augment the module so consumers type-check.
declare module 'frappe-ui/frappe' {
  export function useTelemetry(): {
    isEnabled: boolean
    disable: () => void
    capture: (event_name: string, data?: Record<string, any>) => void
  }
}