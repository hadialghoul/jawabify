# Fix number search in the inbox

## Short answer: it's on our side

Search only matches the phone number **exactly as it is stored**. Numbers are saved in
international format with no leading zero, e.g. `+9613306156`. So:

- typing `3306156` or `+9613306156` → found
- typing `03306156`, `03 306 156`, `03-306-156`, `00961 3 306156` → not found

That is why it "wasn't working" and then worked once the user happened to type the number
the same way it is stored. Nothing is wrong with the user's account, and no data was missing
(the largest workspace has ~3,000 contacts, well inside the loaded list).

Two smaller contributors:
- Many contacts have no saved name, so only the number can be matched.
- If the user searches in the first second after opening the inbox, the conversation list may
  still be loading and shows nothing found.

## What to change

1. Normalize both sides of the phone comparison before matching:
   - strip everything except digits from the typed query and from the contact number
   - drop a leading `00` and a single leading `0` from the query
   - match if the contact's digits contain the normalized query (so local, international, and
     partial forms all hit)
2. Keep name/text matching as it is today.
3. Show an explicit empty state in the conversation list ("No conversations match …") instead of
   a blank area, and a "loading conversations" line while the initial list is still fetching, so
   a search during load is never mistaken for "not found".

## Technical notes

- All changes are in `src/components/chat/ConversationList.tsx` (presentation only): add a small
  `digitsOnly` / `normalizeQuery` helper and use it inside the existing `filteredContacts` memo;
  add empty/loading rows under the list.
- Optionally apply the same helper to the CRM search in `src/components/crm/CrmTab.tsx` so number
  lookup behaves identically there.
- No backend, schema, or contact-storage changes; numbers stay stored in E.164.
