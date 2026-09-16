# Owner and technician quick start

## Review mode

The blue **Interactive demo** banner identifies fictional browser data. Switch among Client, Technician and Owner to review the same synthetic records. Reset under Account. No email, uploaded files or real invitations are involved.

## Owner / dispatcher

1. Open **Requests**. Use New/Unassigned/Waiting on client/Parts tabs, search and filters. Staff-created requests preserve phone intake as their source.
2. Open a request → **Manage request**. Choose responsible technician, priority, kind and target date. General questions can become support/estimate work without replacing the conversation.
3. Use **Manage sharing** to add an organization contact or technician collaborator. Client administrators already see their organization's history; ordinary contacts see own/shared requests.
4. Write a public reply by default. **Internal** switches to the contrasting staff-only composer. Site context lives separately and never reaches clients.
5. **Calendar → Schedule a visit** creates a proposal or confirmed visit. Preferred estimate windows are not reservations. Conflicts include staff hours, travel buffers and approved absence. Review any override and enter its reason.
6. **Clients** maintains organization tags, multiple locations, site contacts/services, internal site context and organization access. Membership removal revokes subsequent access while retaining history.
7. **Team → Add technician**: enter their name and email, optionally select businesses, then save. Demo technicians are immediately usable synthetic records; connected technicians remain pending until they accept the prepared link. No invitation email is sent. **Other invitations** handles dispatchers and client contacts.
8. **Connect businesses / Manage businesses** on a technician card chooses their defaults in one place. You can also use **Clients → Default technician → Connect technician / Change**. New requests route automatically; existing work stays assigned. One business has one default technician, and a technician can cover multiple businesses. Removing a default sends future requests to the unassigned queue.
9. **Team** also shows workloads, hours, role changes and access controls. Deactivation pauses business routing and leaves existing work/visits visible for reassignment; it does not cancel visits.
10. **Reports** defines calendar-time response/resolution measures and exports safe CSV. **Settings** controls contact details, categories, hours/buffers and closure. Do not enable auto-close until the worker is verified.

Real invitations remain pending approval. Prepared links contain account access tokens: share only with the intended verified recipient through an approved secure channel and never paste them into logs or issue trackers.

## Technician

1. Open **Today / My work** and the assigned request. Read the client issue and relevant location/site information.
2. Reply in the public conversation, or explicitly switch to **Internal** for staff diagnostics. Request photos are public; attachments added to an internal note remain internal.
3. Open the visit for map/call links and preparation. Update **En route → On site → Completed** manually. Check tasks and enter a work summary; note follow-up work there.
4. Add before/after photos to the associated request with descriptive filenames. Add labor/materials in **Time entries**; edit your own entries as needed. Owner corrections are audited.
5. Completing a visit does not resolve its request. Resolve only when appropriate, with a public completion summary. A client reply to a resolved request within the configured window reopens it; closed requests offer a linked follow-up.
6. Submit unavailable periods in Calendar. They block dispatch after approval; the dispatcher must reassign existing conflicts first.

## Client

Choose Get support, Request an on-site estimate, or Message Net-Tech. Complete the short form, review the receipt, and keep replies in that request. An estimate request or proposed time is awaiting confirmation. A change/cancellation request keeps the current confirmed visit active until staff approves it. Use Add to calendar for an `.ics` file; there is no external calendar synchronization.

If disconnected, reconnect before retrying. Request/message retries reuse an idempotency key. A failed attachment leaves the saved request intact; retry the file without creating a new request. Expired sign-in returns to authentication. Contact Net-Tech through the configured support details if account access has been removed or an invitation expires.
