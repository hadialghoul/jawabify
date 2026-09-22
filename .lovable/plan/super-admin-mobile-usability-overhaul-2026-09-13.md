# Super Admin mobile usability overhaul

## Goal
Make every Super Admin screen practical on phones without changing admin capabilities or business logic.

## Changes
- Replace the desktop-style mobile drawer experience with a clear mobile menu, larger tap targets, visible close behavior, and automatic closing after navigation.
- Simplify the mobile page header and preserve safe-area spacing while keeping the active section obvious.
- Reflow overview metrics and charts so labels remain readable and charts do not overflow narrow screens.
- Convert tenant, user, subscription, payment, lead, and alert layouts into phone-friendly stacked cards with full-width actions where needed.
- Make search, filters, refresh controls, and destructive actions reachable with at least 44px touch targets.
- Adapt the Admin Inbox to a mobile list-to-conversation flow rather than squeezing both panes side by side.
- Tighten campaign and broadcast layouts for small screens while retaining all controls.

## Verification
- Test the authenticated Super Admin flow at 430×786 and a narrower phone width.
- Open every Super Admin section, exercise navigation and key controls, and check for horizontal overflow, clipped text, overlapping elements, and inaccessible actions.
- Confirm the project builds cleanly and review browser console/runtime errors.

## Technical details
- Scope changes to Super Admin presentation code and shared responsive styles only.
- Keep existing data fetching, permissions, billing actions, messaging behavior, and account impersonation unchanged.
- Use existing semantic design tokens and UI components throughout.
