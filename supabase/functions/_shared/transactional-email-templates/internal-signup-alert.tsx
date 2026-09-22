/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  email?: string
  firstName?: string
  businessName?: string
  businessType?: string
  signedUpAt?: string
}

const Email = ({ email, firstName, businessName, businessType, signedUpAt }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New Jawabify signup: {email || 'unknown email'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New signup 🎉</Heading>
        <Text style={text}><strong>Email:</strong> {email || '—'}</Text>
        <Text style={text}><strong>Name:</strong> {firstName || '—'}</Text>
        <Text style={text}><strong>Business:</strong> {businessName || '—'}</Text>
        <Text style={text}><strong>Business type:</strong> {businessType || '—'}</Text>
        <Text style={text}><strong>Signed up:</strong> {signedUpAt || new Date().toISOString()}</Text>
        <Hr style={hr} />
        <Text style={textMuted}>Automated notification from Jawabify.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Props) => `New Jawabify signup: ${data?.email || 'new user'}`,
  displayName: 'Internal signup alert',
  // No fixed `to` — the caller passes each internal recipient so multiple
  // addresses (Info@theleadsbridge.com, jawabify@gmail.com) each get a copy.
  previewData: {
    email: 'jane@example.com',
    firstName: 'Jane',
    businessName: 'Jane Coffee',
    businessType: 'restaurant',
    signedUpAt: new Date().toISOString(),
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Urbanist, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { color: 'hsl(240, 40%, 8%)', fontSize: '22px', lineHeight: '1.3', margin: '0 0 16px' }
const text = { color: 'hsl(240, 40%, 8%)', fontSize: '15px', lineHeight: '1.6', margin: '0 0 10px' }
const textMuted = { color: 'hsl(240, 10%, 42%)', fontSize: '13px', lineHeight: '1.6', margin: '0' }
const hr = { border: 'none', borderTop: '1px solid #eaeaea', margin: '24px 0' }
