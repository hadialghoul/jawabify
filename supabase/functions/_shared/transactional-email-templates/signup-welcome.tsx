/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Button, Hr, Link,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const BOOKING_URL = 'https://calendly.com/jawabify/15'

interface Props {
  firstName?: string
  businessName?: string
  bookingUrl?: string
}

const Email = ({ firstName, businessName, bookingUrl = BOOKING_URL }: Props) => {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Welcome to Jawabify — book your 15-min onboarding call</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Welcome to Jawabify{businessName ? `, ${businessName}` : ''} 👋</Heading>
          <Text style={text}>{greeting}</Text>
          <Text style={text}>
            Thanks for signing up. Jawabify turns your WhatsApp into an AI-powered assistant that answers
            customers 24/7, takes orders, books appointments, and hands off to your team when it matters.
          </Text>
          <Text style={text}>
            The fastest way to get value is a quick <strong>15-minute Zoom showcase</strong>. We'll
            walk you through setup, connect your WhatsApp number, load your product/service knowledge,
            and show you the AI in action on your own data.
          </Text>
          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button href={bookingUrl} style={button}>Book my 15-min onboarding call</Button>
          </Section>
          <Text style={textMuted}>
            Prefer a link? <Link href={bookingUrl} style={link}>{bookingUrl}</Link>
          </Text>
          <Hr style={hr} />
          <Text style={textMuted}>
            Questions? Just reply to this email or WhatsApp us at +971 52 350 6806.
          </Text>
          <Text style={textMuted}>— The Jawabify team</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: 'Welcome to Jawabify — book your 15-min onboarding call',
  displayName: 'Signup welcome',
  previewData: { firstName: 'Sara', businessName: 'Acme Co.' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Urbanist, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { color: 'hsl(240, 40%, 8%)', fontSize: '24px', lineHeight: '1.3', margin: '0 0 16px' }
const text = { color: 'hsl(240, 40%, 8%)', fontSize: '15px', lineHeight: '1.6', margin: '0 0 14px' }
const textMuted = { color: 'hsl(240, 10%, 42%)', fontSize: '13px', lineHeight: '1.6', margin: '0 0 8px' }
const button = {
  backgroundColor: 'hsl(243, 75%, 59%)', color: '#ffffff', padding: '14px 24px',
  borderRadius: '12px', fontSize: '15px', fontWeight: 600, textDecoration: 'none', display: 'inline-block',
}
const link = { color: 'hsl(243, 75%, 59%)', textDecoration: 'underline' }
const hr = { border: 'none', borderTop: '1px solid #eaeaea', margin: '28px 0' }
