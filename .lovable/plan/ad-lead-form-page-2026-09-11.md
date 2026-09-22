# Ad Lead Form Page

## Goal
Create a focused `/form` page for paid-ad visitors to submit their contact details, with minimal distractions and clear follow-up expectations.

## What will be built
- A standalone, mobile-first Jawabify lead page with logo, concise value proposition, trust points, and one prominent form.
- Fields for full name, business name, phone/WhatsApp number, email, business type, and the main help they need.
- Clear validation, loading, error, and success states.
- Lead storage in the existing consultation leads area so submissions remain visible to the team.
- Campaign attribution from common URL parameters such as `utm_source`, `utm_campaign`, and `utm_content`.
- Meta Lead conversion tracking after a successful submission.
- A `/form` route with page-specific title, description, canonical URL, and social metadata.

## Technical details
- Add a focused page component without the full marketing navigation or footer, reducing exits from ad traffic.
- Store required contact fields in the existing lead columns and encode optional business/context details into the source attribution field without changing the database schema.
- Use existing Jawabify design tokens and shared form controls.
- Add client-side length, email, and phone validation before saving.
- Verify the page at desktop and mobile widths, submit a test through the live preview where safe, and confirm the project builds successfully.
