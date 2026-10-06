# Community help expansion proposal

**Status:** Phase 1 implementation is included on this branch for review. Phases 2–4 remain proposals.

CivicHands already separates public community-ready work, city referrals, and private neighbor support. Keep that separation as the product grows. The app should match a need with an appropriately capable helper or trusted organization, while directing emergencies and regulated work to the responsible professionals.

## Product rule

Every new service lane must define:

1. Who may request it and who may respond.
2. Whether the request is public, private, or agency-controlled.
3. What capability or credential is required and how it is verified.
4. What locations/details each role can see, and when.
5. What happens when the situation is urgent, unsafe, out of scope, or resolved elsewhere.

A general “vetted helper” badge means the person passed CivicHands’ community-helper review. It does **not** mean the person is licensed, insured, trained for roadside work, medically qualified, or authorized to perform regulated work.

## Proposed service lanes

| Lane | Examples | Who can respond | Visibility and boundary |
| --- | --- | --- | --- |
| Community-ready | Cleanup, carrying, simple outdoor tasks, supply delivery to a public pickup point | Members or vetted helpers according to task risk | Public, reviewed, approximate location |
| Neighbor support | Yard work, cleaning, wellness check-ins, simple errands | Vetted helpers; requester chooses a helper | Private request; exact address shared only after consent and acceptance |
| Equipment-assisted help | Jump start from a portable jump pack or cables, tire inflation, tool lending | Helpers who have marked the specific equipment and accepted the task | Only when the vehicle/person is safely away from moving traffic; otherwise direct to roadside assistance or 911 |
| Verified provider service | Consent tow, roadside recovery, other regulated local services | Business/provider account whose applicable company, operator, vehicle, insurance, and credential records have been checked | Private request and dispatch details; only matching providers see exact location |
| Lost and found pets | Lost pet, found pet, safe temporary care, transport to a shelter or veterinarian | Nearby members for low-risk sighting/transport tasks; shelters, animal control, or veterinary partners for handoffs | Public post uses an approximate location; contact details stay private; verify ownership before disclosing identifying details |
| Community resource connection | Food pantry hours, cooling/charging sites, shelter, supplies, disaster recovery | Verified nonprofits, agencies, and community organizations | Public service directory and availability; do not publish a resident’s sensitive need without consent |
| Agency-coordinated safety case | Missing person, endangered person, serious welfare concern | Law enforcement or another authorized case owner; public only through approved, official material | Never an open volunteer-search board; tips go to the named agency, and sensitive details stay restricted |

## First feature: jump-start requests

This is a useful, bounded extension of Neighbor support.

### Request form

- Choose **Jump start** and whether the requester needs a helper with jumper cables, a portable jump pack, or either.
- Ask whether the vehicle is parked in a driveway, parking lot, or other place clearly separated from moving traffic.
- Ask for vehicle make/model/year only when useful to determine compatibility; never require a VIN or license plate in public.
- Ask about visible battery damage, smoke, leaking, unusual odor, or a hybrid/EV. If any hazard is reported, stop matching and show the appropriate professional/emergency path.
- Requester chooses a vetted helper from offers. Exact location appears only to that accepted helper.
- The helper confirms the equipment and safe location before accepting. They can cancel without penalty if the situation differs from the description.
- Requester and helper can mark the task complete or report an unsafe situation. Keep an audit event for every transition.

### Helper capability profile

Add opt-in, structured capabilities rather than assuming every vetted helper can do every task:

- Has jumper cables; has portable jump pack; equipment availability and last-confirmed date.
- Vehicle type the helper can safely support (including “I only help with standard 12V systems”).
- Service area, times generally available, and accessibility/language preferences.
- Optional experience notes, private to moderators and requesters receiving an offer.
- Explicit statement that the helper is a neighbor volunteer, not a mechanic or emergency responder unless separately verified.

Do not ask helpers to connect a jump pack to a high-voltage traction system. In-app instructions should not attempt to replace the vehicle manufacturer’s instructions. Do not match the request if the vehicle is exposed to traffic or has signs of battery damage, smoke, fire, leaking, or another hazard.

## Towing and roadside recovery

Treat this as a verified-provider lane rather than a normal volunteer offer. A license or business profile alone is not a promise that an operator may safely enter a live lane or handle every incident. The platform should distinguish “request a consent tow from a safe location” from “vehicle or person creating an immediate roadway hazard.”

### Provider onboarding and dispatch

- Require a provider organization and named dispatch contacts.
- Verify the applicable company license, operator credential, truck permit, insurance evidence, coverage area, expiry, and service type against the relevant regulator or issuing authority. Store the source, reviewer, check date, and expiry; recheck before expiration and suspend matching when expired.
- Match only a provider whose credential scope fits the request and jurisdiction.
- Present the provider’s identity, quoted/estimated charges when available, and cancellation/contact path before the requester accepts.
- Share exact location and contact details only with the selected provider after explicit requester consent.
- Keep a non-public audit history of verification, assignment, arrival, cancellation, and resolution.

For a Texas launch, TDLR distinguishes tow operator licenses and truck permits by service type; its incident-management permit covers a disabled vehicle on or near a public road when towing may affect normal traffic flow. The exact current rules must be confirmed for each launch jurisdiction. CivicHands must not describe a consent-tow credential as authorization for incident-management towing.

If a vehicle is in a live lane, an immediate crash scene, or another life-threatening position, CivicHands should stop volunteer matching and direct the person to 911/emergency services or the appropriate official roadside-assistance program. Never send a community helper into traffic.

## Lost and found animals

Start with domestic pets only. Wildlife and injured/aggressive animals need a handoff path to animal control, a veterinarian, or a licensed wildlife rehabilitator; do not turn those reports into public volunteer capture tasks.

- Separate **lost pet** and **found pet** reports, with species, distinctive description, photo, date/time, and approximate last-seen/found area.
- Avoid publishing the exact home address, a finder’s current holding location, private contact information, or a precise live location.
- Allow a private contact relay so neither side must publish a personal phone number.
- Ask report authors to keep one or two identifying details private so a claimant can establish ownership.
- Show a “do not approach” route for injured, aggressive, unfamiliar, or wildlife cases and route to an appropriate local service.
- Let the owner/finder mark reunited, transferred to shelter/animal control, or still unresolved. Publish no identity or exact home location in the transparency log.

Later options: shelter/animal-control partner accounts, microchip lookup guidance through the registered chip provider, and opt-in match notifications based on species, description, and approximate area.

## People reported missing or needing a welfare check

This needs a distinct, controlled design. It should not be a standard Need type or a public map marker.

- For immediate danger, a missing child, suspected abduction, or medical emergency, direct the reporter to call 911 or contact law enforcement immediately. Do not imply CivicHands is a substitute for a police report.
- Never create an open search party, publish a home/school/work location, expose a reporter or family member, or route unverified sightings to volunteers.
- Consider a future agency-controlled case page only after a report has been made to law enforcement, the authorized agency or case owner has verified the case and approved the exact public content, and the family/authorized party’s consent rules are recorded.
- Provide an **official tip destination** and show the agency’s instructions. Keep tips private and route them to that agency; do not let users investigate, confront people, enter property, or share rumors.
- Give the agency/authorized owner an immediate unpublish/resolve control. Log changes without exposing sensitive details publicly.

A simpler first release can provide resource links and emergency guidance only; it does not need to store a person’s name or case details.

## More useful community capabilities

After the first bounded workflows, consider these in order:

1. **Resource directory:** food, water, cooling/charging, shelters, transportation, animal services, disaster recovery, and accessibility services. Let verified organizations maintain hours, eligibility, languages, and current availability.
2. **Mutual aid requests:** groceries, household essentials, small supplies, and public-place drop-offs. Keep health, immigration, financial, and other sensitive details out of public text.
3. **Tool and equipment lending:** opt-in inventory, availability windows, pickup/drop-off terms, and return confirmation. No public home addresses.
4. **Accessibility help:** temporary ramp/entry help, carrying items, or accessibility checks with clear task limits; avoid medical care and unsupervised in-home work.
5. **Storm and heat response:** verified cooling centers, supply distribution, debris cleanup only after hazards are cleared, and status updates from official sources.
6. **Civic follow-up:** keep the existing city-referral lane, add agency/service-area routing, acknowledgement IDs, public status updates, and escalation when a referral is stale.
7. **Community skills directory:** opt-in, scoped skills (translation, repair, tutoring, tax/legal/medical referral navigation) that do not imply professional credentials unless separately verified.

Rides, medication handling, childcare, in-home work with minors or vulnerable adults, medical assistance, and emergency response should remain later controlled programs with separate insurance, safeguarding, and partner review.

## Shared request lifecycle

Use a common lifecycle where it fits, but allow lane-specific states:

- Draft → submitted → moderation/eligibility review → open for offers or provider response → accepted/assigned → in progress → resolved.
- Also allow canceled, referred, expired, and reopened outcomes.
- Keep “referred” distinct from “resolved”; an external agency or provider may not yet have addressed the need.
- Requester consent is required before revealing sensitive location/contact data.
- Only the requester, selected helper/provider, and authorized staff see private details.
- Public history says what happened and when, without revealing a resident/helper identity or sensitive details. Agency and official-capacity actions may be named under the existing transparency rules.
- Add a private abuse/safety report to every request and a fast way to freeze matching or hide sensitive content while moderators review it.
- Never use points, public failure counts, response-time rankings, or streaks.

## Data and architecture direction

Avoid adding every new use case to the existing free-text `category` field. Keep `needKind` for broad workflow and introduce reviewed, typed subtypes or capability tags with lane-specific validation.

Likely additions after design review:

- `serviceType` enum or controlled table; versioned form schema and safety rules.
- Helper capability records with capability, equipment status, service area, verification status, verified-by, verified-at, expires-at, and private evidence reference.
- Provider organizations, memberships, jurisdiction-scoped credentials, insurance checks, coverage areas, and eligibility rules.
- Request-specific private structured details separated from public title/description.
- Consent events for location/contact sharing.
- Assignments/dispatches distinct from offers; a tow provider is not a generic volunteer.
- Lost/found pet matching record and private relay contact.
- Agency-owned safety case reference/content only if a future partnership justifies it.

Keep the existing append-only audit model. Put sensitive details in private tables/columns; never place them in a public audit summary, public API, notification title, analytics event, or map payload.

## Rollout gates

### Phase 1 — Equipment-assisted neighbor help

Included in this branch:
- Vetted helpers can self-report jumper cables and/or a portable jump pack, with a confirmation timestamp.
- Jump-start requests ask for compatible equipment and vehicle type, and require the requester to confirm an off-road location, a standard 12V vehicle, and no visible hazards.
- Matching checks equipment when a helper offers and again when the requester accepts. Helpers must also affirm the off-road safety boundary.
- Jump-start titles/descriptions stay generic; vehicle details and exact locations are limited to the requester and accepted helper. The public API exposes only approximate locations and the equipment requested.
- Public history records the workflow without exposing private vehicle details.

Review and verify these checks against a working preview before considering Phase 1 complete.

### Phase 2 — Lost/found pets

1. Consult local animal control and shelters; define local routing and emergency copy.
2. Add the two report flows, approximate map placement, private relay, hidden verification detail, and removal/reunited controls.
3. Test abuse, ownership disputes, unsafe-animal escalation, and privacy from screenshots/public APIs.

### Phase 3 — Verified roadside providers

1. Select the initial jurisdiction and define credentials with its regulator and insurer requirements.
2. Review provider terms, consumer disclosures, quote/fee presentation, complaints, retention, and dispatch liability with counsel and local partners.
3. Build private provider onboarding, jurisdiction-specific checks, expiry revalidation, and matching only after gates pass.
4. Pilot consent tows from safe locations; do not dispatch to active traffic scenes.

### Phase 4 — Agency-coordinated missing-person information

Proceed only with written agency/advocacy partner workflows, privacy/security review, explicit content approval, official tip routing, and rapid removal/escalation. If those requirements are unavailable, keep CivicHands to emergency guidance and official resource links.

## Texas pilot references

These are design inputs, not legal advice or a nationwide ruleset. Recheck current official requirements before launch and repeat the work for every jurisdiction:

- [TDLR towing overview and license search](https://www.tdlr.texas.gov/towing/)
- [TDLR tow operator license types](https://www.tdlr.texas.gov/towing/apply-tow-operator.htm)
- [TDLR tow truck permits, insurance, and incident-management scope](https://www.tdlr.texas.gov/towing/apply-tow-truck.htm)
- [TxDOT Move Over or Slow Down](https://www.txdot.gov/safety/traffic-safety-campaigns/move-over-or-slow-down.html)
- [TxDOT emergency contact guidance](https://www.txdot.gov/about/contact-us.html)
- [TPWD guidance for injured/orphaned wildlife](https://tpwd.texas.gov/huntwild/wild/rehab/orphan/)
- [FBI missing-child reporting guidance](https://www.fbi.gov/how-we-can-help-you/parents-and-caregivers-protecting-your-kids)
- [NamUs publication and case-vetting FAQ](https://namus.nij.ojp.gov/frequently-asked-questions)
