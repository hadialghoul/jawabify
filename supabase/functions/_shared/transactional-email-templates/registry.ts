/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { template as signupWelcome } from './signup-welcome.tsx'
import { template as leadWelcome } from './lead-welcome.tsx'
import { template as internalSignupAlert } from './internal-signup-alert.tsx'

export interface TemplateEntry {
  component: (props: any) => React.ReactElement
  subject: string | ((data: any) => string)
  displayName?: string
  previewData?: Record<string, any>
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'signup-welcome': signupWelcome,
  'lead-welcome': leadWelcome,
  'internal-signup-alert': internalSignupAlert,
}
