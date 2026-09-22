/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Button, Hr, Link,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const BOOKING_URL = 'https://calendly.com/jawabify/15'

interface Props {
  fullName?: string
  bookingUrl?: string
}

const Email = ({ fullName, bookingUrl = BOOKING_URL }: Props) => {
  const firstName = fullName ? fullName.split(' ')[0] : ''
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Thanks for reaching out — book your free 15-min Jawabify demo</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Thanks for reaching out 👋</Heading>
          <Text style={text}>{greeting}</Text>
          <Text style={text}>
            We got your request for a Jawabify consultation. Instead of playing phone tag, grab a
            <strong> free 15-minute Zoom showcase</strong> at a time that works for you — we'll
            demo the AI on WhatsApp live and answer any questions about pricing, setup, and rollout.
          </Text>
          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button href={bookingUrl} style={button}>Book my 15-min demo</Button>
          </Section>
          <Text style={textMuted}>
            Prefer a link? <Link href={bookingUrl} style={link}>{bookingUrl}</Link>
          </Text>
          <Text style={text}>In the showcase we'll cover:</Text>
          <Text style={text}>
            • How the AI answers customers 24/7 on WhatsApp<br />
            • Taking orders, bookings, and lead capture automatically<br />
            • Connecting your catalog / knowledge base<br />
            • Pricing and what a rollout looks like for your business
          </Text>
          <Hr style={hr} />
          <Text style={textMuted}>
            Questions? Reply to this email or WhatsApp us at +971 52 350 6806.
          </Text>
          <Text style={textMuted}>— The Jawabify team</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: 'Book your free 15-min Jawabify showcase',
  displayName: 'Lead welcome',
  previewData: { fullName: 'Alex Rivera' },
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
