# MySet landing-page analysis

**Page audited:** [https://myset.vip/about](https://myset.vip/about)  
**Audit date:** 1 September 2026  
**Primary conversion assumed:** a working musician creates a free artist page and reaches a first successful live show  
**Secondary conversion:** a venue owner claims a venue page  

> **Important:** This is a heuristic conversion, offer, messaging, UX, and funnel audit. It is not a substitute for observed conversion data. Where I say that something is likely to help or hurt conversion, that is a testable hypothesis, not a claim that the page has already produced a measured result.

## Sources and method

This analysis combines:

- A complete desktop and mobile inspection of the live page, including the interactive voting demo, every visible section, the FAQ content, and the `/studio` handoff reached by the main CTA.
- A source-level inspection of [public/about.html](/Users/perryidyll/Docs/MySet/public/about.html) and the shared design system in [public/app.css](/Users/perryidyll/Docs/MySet/public/app.css).
- The user-supplied [Daniel Priestley’s Landing Page Formula.pdf](</Users/perryidyll/Downloads/Daniel Priestley’s Landing Page Formula.pdf>), treated as source material rather than as instructions.
- Daniel Priestley’s fuller *Scorecard Marketing* model: [official book PDF](https://cdn.scoreapp.com/assets/book/Scorecard_Marketing_by_Daniel_Priestley.pdf) and [ScoreApp’s explanation of scorecard funnels](https://www.scoreapp.com/scorecard-marketing/).
- Alex Hormozi’s value equation and offer principles: [Acquisition.com value checklist](https://www.acquisition.com/hubfs/Offer%20Checklists%20-%20PDF%20Downloads/Pricing-Value-Checklist.pdf?hsLang=en), [offer creation checklist](https://www.acquisition.com/hubfs/Offer%20Checklists%20-%20PDF%20Downloads/Offer%2BCreation%2BChecklist.pdf?hsLang=en), and [guarantee checklist](https://www.acquisition.com/hubfs/Offer%20Checklists%20-%20PDF%20Downloads/Unbeatable-Guarantee-Checklist.pdf).
- Donald Miller’s StoryBrand framework: [official StoryBrand framework PDF](https://storybrand.com/downloads/your-brand-is-not-the-hero.pdf).

The three lenses overlap, but they are not interchangeable:

- **Hormozi asks:** Is the offer so valuable, believable, fast, easy, and low-risk that saying yes feels obvious?
- **Miller asks:** Is one customer unmistakably the hero of one clear story, with MySet acting as the trusted guide?
- **Priestley asks:** Does the page move a visitor into a measurable, data-producing lead journey that qualifies them and gives them personalized value?

## Executive verdict

### The one-sentence diagnosis

**This is unusually strong, human copy wrapped around an under-proven, over-broad offer and an incomplete conversion system.**

The page makes the **mechanism** and **low effort** highly believable: audience members scan, vote, and never install anything; the artist sees the winner; setup is free and fast. It is much less convincing on the variable that matters most once the mechanism is understood: **the visitor’s likelihood of getting a meaningfully better gig, more tips, or more bookings.**

The page is already better than the average early-stage SaaS page in five ways:

1. It can be understood immediately.
2. It dramatizes a real emotional problem in language musicians will recognize.
3. It lets the visitor experience the core interaction without leaving the page.
4. It removes audience friction with exceptional clarity.
5. It sounds like a person, not a committee.

But it loses force for six structural reasons:

1. **The protagonist changes.** The page begins as an artist story, becomes a venue story, and ends serving both.
2. **Proof is too thin and too late.** Screenshots prove that the product exists; they do not prove that it changes a gig.
3. **Some promises outrun current availability.** Payments are sold as part of the transformation before the page later says they are being enabled artist by artist. Pro features are described as “marked” as forthcoming, but they are not visibly marked in the plan.
4. **The page is far longer than its decision requires.** Mobile visitors traverse roughly 18,344 pixels—about 22 phone screens—to reach the bottom.
5. **The post-click experience changes the frame.** “Get your page — free” lands on “Artist Studio — Sign in to run your show,” which sounds like a returning-user gate.
6. **There is no visible learning loop.** The page source contains no client-side conversion instrumentation, and the page itself does not qualify or segment visitors.

### Bottom-line recommendation

Keep the voice, the hero’s basic clarity, the live demo, the no-install promise, and the candid tone. Rebuild the page around this sequence:

**One artist → one painful moment → one promised transformation → live proof → three-step plan → real-world proof → clear offer → objections → one CTA.**

Move the venue pitch to its own page. Treat Priestley’s scorecard as a separate acquisition funnel for cold traffic—not as a mandatory gate in front of free product activation.

## Heuristic scorecard

These scores are diagnostic, not measured conversion results.

| Dimension | Score | Why |
|---|---:|---|
| Immediate comprehension | 9/10 | The headline, subhead, phone mockup, and CTA explain the core interaction quickly. |
| Emotional resonance | 9/10 | The “soft patter,” guessing gap, and room “with you” language are vivid and specific. |
| Audience focus | 5/10 | Artists are clear at first; venues and local-discovery messaging later compete for attention. |
| Dream outcome | 7/10 | A more engaged room and stronger venue pitch are compelling, but the top of page leads with the mechanism. |
| Perceived likelihood | 4/10 | Strong product demonstration, weak customer/outcome proof. |
| Time to value | 9/10 | “Two minutes,” “first song,” “first night,” and “print once” are excellent. |
| Effort and sacrifice | 9/10 | No audience app, account, email, or password; free/no-card artist entry. |
| Risk reversal | 8/10 | Free/no-card and “nothing is worse if nobody votes” are strong; the latter is buried in the FAQ. |
| Offer integrity | 5/10 | Honest note helps, but payments and unshipped Pro features are presented inconsistently. |
| Proof and authority | 3/10 | No testimonials, named case study, real gig footage, venue endorsement, or founder authority block. |
| CTA clarity | 8/10 | Repeated direct CTA; no pricing-card CTAs and a confusing post-click headline. |
| Narrative clarity | 6/10 | Excellent artist story, then multiple stories and outcomes accumulate. |
| Mobile presentation | 8/10 | Responsive and visually coherent with no horizontal overflow; simply too long. |
| Accessibility | 6/10 | Good semantics and FAQ controls; small low-contrast text and ambiguous repeated “Vote” names. |
| Measurement readiness | 2/10 | No visible landing-page event instrumentation or scorecard qualification. |

### Overall heuristic rating: **6.6/10**

That is not “mediocre.” It means the page has unusually good raw material but is leaving conversion leverage unused in the areas that usually matter most: focus, proof, promise integrity, and learning.

---

# Part I — What the page is really selling

## The product is not voting

The current page eventually says this itself: “It’s not really about the votes.” Correct.

The functional product is audience voting. The actual offer is a stack of emotional and commercial outcomes:

1. **Less cognitive load:** the artist stops guessing between songs.
2. **More room energy:** the audience becomes invested in what plays next.
3. **More control without awkwardness:** requests are structured and reversible.
4. **More monetization without begging:** tips and extra votes appear in context.
5. **More booking leverage:** the artist leaves with behavioral proof rather than anecdotes.

That is a strong offer stack. The problem is not that the page lacks benefits; it is that the benefits compete instead of resolving into one dominant promise.

### The current implicit promise

> Let the crowd vote, reduce guessing, create a more engaged gig, earn more, build a public page, document demand, pitch venues, list gigs, power venue calendars, help locals discover live music, and create a marketplace.

This is a product roadmap compressed into a landing page.

### The recommended dominant promise

> **Turn a distracted room into a crowd that is invested in your next song—without adding work while you perform.**

Everything else should support that promise:

- Voting is the mechanism.
- No app is the friction remover.
- Requests and tips are extensions.
- Stats and bookings are the long-term payoff.
- Venue pages are a separate story for a separate visitor.

## The true ideal customer is narrower than the page admits

The language strongly suggests a primary ideal customer:

- A working solo artist, duo, or band.
- Playing recurring bar, pub, restaurant, resort, wedding, or casual venue gigs.
- Often playing at least some covers.
- Facing a distracted or inconsistent room.
- Currently selecting songs by instinct and reading the room.
- Lacking credible evidence of draw and engagement when approaching venues.

That is a good market because the pain is frequent and vivid. Say it plainly. “For live musicians” is more useful than making every visitor infer the avatar from context.

Trying to make the same page equally persuasive to venues weakens the artist message and does not give venues the depth they deserve. A venue owner has a different problem, desired outcome, proof standard, implementation plan, and CTA.

---

# Part II — The first 10 seconds, 30 seconds, and two minutes

## First 10 seconds: excellent

At the top of the page, a visitor can answer:

- **What is this?** A tool that lets the room pick the next song.
- **How?** Audience members vote from their phones.
- **What do they need to do?** Nothing to install.
- **What do I do?** Play the result rather than guess.
- **What does it cost to try?** Free; no card.

This is the clearest part of the page. The headline’s short clauses, gradient emphasis, product screenshot, and direct CTA work together.

## First 30 seconds: emotionally strong, strategically incomplete

The visitor quickly understands the pain of a disengaged room. The prose is memorable:

- “soft patter of clapping”
- “trying to read forty faces at once”
- a room “near you rather than with you”

That is excellent internal-problem language in StoryBrand terms. It names the anxiety and loneliness of performing without feedback.

What remains unresolved at this stage:

- Does this actually improve the room, or merely put more phones in people’s hands?
- Will I lose control of my set?
- What if people choose a song I do not want to play?
- Has a musician like me used this successfully?
- Will venue Wi-Fi ruin it?
- How much setup is required before the stated “two minutes” becomes a useful show?

The page answers most of these eventually, but the proof and control answers arrive too late.

## First two minutes: understanding rises, confidence does not rise at the same rate

The live demo is superb for mechanism comprehension. Clicking “Vote” changes the vote count, the selected button becomes “Voted,” and the number of votes left decreases. It is a genuine micro-experience, not a decorative screenshot.

After that, the page continues explaining features through five large product-screenshot sections. The visitor learns more, but the page does not proportionally increase belief that the desired outcome will occur.

That is the central conversion imbalance:

> **The page keeps adding explanation when it most needs evidence.**

---

# Part III — Alex Hormozi lens

Hormozi’s value equation can be paraphrased as:

**Value rises as the desired outcome and confidence in achieving it increase; value falls as delay, effort, and sacrifice increase.**

MySet performs very differently on the four variables.

## 1. Dream outcome — strong, but too distributed

### What the page gets right

The page identifies several desirable outcomes:

- A room that feels “with” the performer.
- Less anxiety between songs.
- A crowd invested in the winner.
- Tips without an awkward ask.
- Evidence that improves venue conversations.
- A public page that helps people find the artist later.

The best dream-outcome passage is not the hero. It is the transformed room:

> “Heads up. Two lads at the bar arguing about Fleetwood Mac… and they’re watching to see if they won.”

That is vivid future pacing. The reader can see the moment.

### What holds it back

The hero leads with the mechanism: “The room picks the next song.” The emotional result—attention, investment, and energy—is implied rather than stated.

Later, the dream outcome fragments into three different offers:

1. Better gig energy.
2. More money and bookings.
3. A venue/local live-music marketplace.

The result is more total value but less perceived singularity.

### Recommendation

Keep the current headline as a control in an A/B test. Test it against an outcome-led version that still explains the mechanism:

> **Turn a distracted room into a crowd that chooses the next song.**  
> Everyone votes from their phone—no app or account. You see what they want, decide what to play, and leave with proof of what moved the room.

The phrase “you decide what to play” is important. It preserves artist autonomy.

## 2. Perceived likelihood of success — the largest weakness

### What creates belief now

- The product is shown in detail.
- The live demo works.
- Screenshots are specific and visually coherent.
- The FAQ includes one real-use data point: eight people cast twenty-one votes at the first real gig.
- The page admits that the product is early.

These elements prove feasibility and reduce suspicion.

### What is missing

There is no meaningful third-party proof:

- No musician testimonial.
- No venue testimonial.
- No named mini case study.
- No photo or video of a real room using MySet.
- No before/after comparison.
- No identifiable source attached to the animated proof figures.
- No founder authority or “why I built this” explanation.
- No quantified activation or retention evidence.

The current proof block displays figures such as 34 average people, 314 votes across three nights, 12 songs wanted but not played, and 100% “from the room.” Without a named artist, venue, date range, or method, those numbers look illustrative even if they are real.

The product screenshots answer “Is there software?” They do not answer “Will my next gig be better?”

### The highest-leverage fix on the whole page

Replace the generic proof block with a named micro-case study:

> **Sam’s first three MySet gigs**  
> 34 people in the room on average · 314 audience votes · 12 high-demand songs discovered  
> “I stopped guessing after the first round. People started watching the queue and cheering when their song won.”  
> — Sam Cole, live artist, The Lantern, Koh Phangan

Only use a quote and identity that are real and approved. If no testimonial exists, use verifiable event facts, a short real-gig clip, and a plain founder note. Specific truth beats polished vagueness.

Move a compact proof signal immediately below the hero or live demo.

## 3. Time delay — excellent

The page repeatedly lowers perceived delay:

- “Two minutes.”
- “works on the first song.”
- “the first night.”
- “Print it once.”
- “the moment you sign up.”

This is one of the page’s strongest Hormozi variables.

### The risk

“Two minutes” appears to describe account creation, not necessarily time to a gig-ready setup. The FAQ admits that adding songs takes additional time, even with a starter pack.

Do not let “time to account” masquerade as “time to value.” A working landing page should distinguish:

- **Create a page:** approximately two minutes.
- **Make it useful:** add or import songs and display the QR.
- **First result:** the first voting round at the next gig.

### Recommendation

Use a truthful progression, for example:

> Create your page in two minutes. Add the starter setlist in one tap. Run your first vote at your next gig.

If “one tap” or the exact timing is not consistently true, change the wording until it is.

## 4. Effort and sacrifice — excellent for the audience, slightly overstated for the artist

The audience-side friction removal is outstanding:

- No app.
- No account.
- No email.
- No password.
- One scan.
- A printable QR that stays valid.

This is likely MySet’s strongest competitive message.

The artist-side message is also strong:

- Free.
- No card.
- Email-code login.
- One-tap start for the winning song.
- Automated vote refresh.

But “Five things happen. None of them need you” is literally too broad. The artist still needs to create a profile, add songs, display the QR, start the show, decide whether to accept requests, and choose whether to follow the winner.

### Recommendation

Use a lower-risk, equally attractive line:

> **Five things happen while you keep playing.**

or:

> **The room stays involved without you stopping the show.**

This protects credibility without weakening the benefit.

## Risk reversal

The page contains unusually good risk reversal:

- Free forever.
- No payment card.
- No trial to cancel.
- No audience install.
- If nobody votes, the artist simply plays what they would have played anyway.

The last point is the most psychologically useful and is buried in the FAQ.

### Recommendation

Bring it close to the first CTA:

> **If nobody votes, nothing breaks—you play the set you already planned.**

This directly neutralizes the fear that MySet will make a gig awkward.

Because the product is free to start, a dramatic money-back guarantee is unnecessary. The best guarantee is operational and truthful:

> Set it up for your next gig. If the room ignores it, keep playing exactly as before.

## Scarcity and urgency

There is no scarcity, and that is fine. Fake scarcity would damage this brand.

There is, however, a natural and ethical deadline: the visitor’s next gig.

Use event-based urgency:

- “Set it up before your next gig.”
- “Print the QR tonight; try it on your first song tomorrow.”
- “Your next gig can be your first measured gig.”

This creates action without inventing a countdown.

## Offer stack and bonuses

The current page treats every feature as part of one large stack. That creates abundance but not hierarchy.

The offer should be framed as:

### Core transformation

**A live voting system that turns song choice into audience participation.**

### Included accelerators

- Printable QR kit.
- Starter setlist.
- Live ranked queue.
- Request controls.
- Automatic show history.
- Public artist page.

### Outcomes

- Easier decisions.
- More room investment.
- Better evidence for venue pitches.

Avoid artificially pricing these as “bonuses” on the page. The product is low-cost and early; inflated value stacking would clash with its candid tone.

## Pricing

### What works

- Free, Plus, and Pro are easy to compare.
- “Most artists” guides the visitor toward Plus.
- The paid tiers map roughly to increasing professional maturity.
- The free tier is genuinely low risk.

### What does not

1. **There are no CTAs inside the plan cards.** A visitor who decides at pricing cannot act there.
2. **The economic break-even is hidden.** If Free takes 10% and Plus costs $10 per month with no cut, Plus is cheaper above $100 in monthly app revenue. That is easy value communication.
3. **The Pro plan lists unavailable features as normal checked benefits.** The later note says forthcoming extras are “marked above,” but the plan does not visibly mark them.
4. **Payments are featured before their limited rollout is disclosed.** That creates an avoidable trust gap.

### Recommendation

- Add “Start free” to Free.
- Add “Start free, upgrade anytime” to Plus and Pro if checkout is not part of first activation.
- State the Plus break-even only after payments are reliably available: “If you earn more than $100/month through MySet, Plus costs less than the Free plan’s 10% share.”
- Put a visible **Coming soon** tag next to every unshipped Pro item—or remove Pro from the pricing comparison until it can be purchased and used.
- Do not market paid-vote or tip functionality as universal until it is universal.

---

# Part IV — Donald Miller / StoryBrand lens

StoryBrand’s seven-part structure is: a character with a problem meets a guide who gives them a plan, calls them to action, and shows the stakes of success and failure.

## 1. Character — clear at first, then replaced

### Current hero

The implied character is a live musician performing to a distracted bar. This is specific enough to feel real and broad enough to include many working acts.

### Failure

The page later introduces a new hero: the venue owner who forgets listings, guesses which act fills Tuesday, and fields musician emails. It finally nods to a third character: the local looking for live music.

The artist’s story does not simply gain a supporting character; it is interrupted by a second sales narrative.

### Recommendation

Create two pages:

- `/artists` — artist-only story and CTA.
- `/venues` — venue-only story and CTA.

The artist page can include one short bridge:

> Venues get real engagement numbers too—so your MySet profile becomes a stronger pitch.

Then link to “See MySet for venues.” Do not run the full venue pitch inside the artist’s decision path.

## 2. Problem — best-in-class internal problem, too many external problems

### External problem

The artist does not know what to play next or what the room wants.

### Internal problem

The artist feels the “low-grade hum” of uncertainty: “Am I losing them?”

### Philosophical problem

A live performance should feel shared, not like background sound happening near a distracted room.

This is excellent three-layer problem construction.

### Where it sprawls

The page adds more external problems:

- Unstructured requests.
- Awkward tipping.
- Audience follow-up.
- Weak venue pitches.
- Venue calendar maintenance.
- Local event discovery.

These are real, but they cannot all be the inciting problem.

### Recommendation

Make every section answer one question:

> How does this help me turn uncertain song choice into a more engaged room without distracting me from performing?

Stats and venue pitching then become the “and you also leave with proof” payoff—not a new story.

## 3. Guide — empathy is strong, authority is weak

The page demonstrates empathy exceptionally well. Whoever wrote it understands the performer’s moment between songs.

But MySet’s authority is nearly absent:

- No visible founder.
- No explanation of who built it or why.
- No named performer behind the insight.
- No credible third-party endorsement.
- No case study.
- “Built on Koh Phangan” appears only in the footer.

In StoryBrand terms, the guide needs both empathy and authority. MySet has empathy; it has not yet shown authority.

### Recommendation

Add a compact guide block after proof:

> **Built during real gigs, not in a meeting room.**  
> MySet was built on Koh Phangan by a working musician who wanted to stop guessing what the room wanted. It has been tested in live venues with real audiences, and it is being improved in public after every show.

Only use claims that are accurate. Pair the block with a real photo, name, and one exact gig fact.

## 4. Plan — signup steps are not a success plan

The final page presents:

1. Your email.
2. A six-digit code.
3. Your name.

These are account-creation steps. They explain how to enter the product, not how the visitor succeeds.

A StoryBrand plan should collapse uncertainty about adopting and using the product.

### Recommended three-step plan

1. **Create your page and choose the songs you want visible.**
2. **Put your QR on a table, screen, or sign.**
3. **See what the room wants, play what fits, and keep the night’s numbers.**

Under this, use the logistical reassurance:

> Free forever · no card · audience members never create an account

This plan also answers the autonomy objection: the artist chooses the visible songs and still decides what fits.

## 5. Call to action — strong on-page, weak in the handoff

“Get your page — free” is direct, frequent, and specific enough to work.

“See how it feels” is evocative but vague. “Try a live vote” would be clearer and more action-oriented.

The most damaging CTA issue occurs after the click. The new visitor lands on:

> “Artist Studio”  
> “Sign in to run your show.”

This creates a narrative discontinuity. A visitor asked to **get** a page and is told to **sign in**, a phrase associated with an existing account.

The small line “New here? Same button—we’ll set you up right after the code” repairs the confusion, but only after it is created.

### Recommendation

Change the handoff to:

> **Create or open your artist page**  
> Enter your email. We’ll send a six-digit code—no password and no card.

Primary button:

> **Continue with email**

Then show a short progress indicator:

> Email → Name → Setlist → Your QR

## 6. Failure — vivid and useful, occasionally too cutting

The page makes failure concrete:

- Soft applause.
- Guessing in the gap.
- A room “near” the artist.
- Packing up after someone says “that was nice, mate.”

This is emotionally precise and avoids abstract marketing language.

The risk is artist defensiveness. The page occasionally sounds as though the performer is failing because the room is bored. A working musician may blame the venue, crowd, repertoire, or night—not themselves.

### Recommendation

Keep the pain but externalize the enemy:

> The room is split across forty screens, the venue is noisy, and the gap between songs gives you almost no signal. MySet turns those screens into one shared choice.

This preserves dignity and makes distraction, not the artist, the villain.

## 7. Success — vivid in the middle, under-proven in reality

The transformed room is excellent StoryBrand success imagery. The identity transformation is also powerful:

- From guessing to knowing.
- From background music to a shared contest.
- From unsupported claims to documented demand.
- From asking venues for a favor to arriving with evidence.

The page should show this success with humans, not just describe it. Product screenshots dominate the visual system. A real crowd reaction, artist quote, and venue quote would make the successful ending credible.

---

# Part V — Daniel Priestley lens

## Strict verdict: this is not a complete Priestley-style lead-generation system

The supplied formula expects three integrated components:

1. A persuasive landing page.
2. A questionnaire that captures details, measures best-practice behavior, and asks qualifying questions.
3. Dynamic results with a score, personalized insights, and a next step matched to qualification.

MySet currently has:

- A persuasive landing page: **yes**.
- A questionnaire: **no**.
- Dynamic results and segmented next steps: **no**.

The interactive voting demo is not a scorecard. It teaches the product but does not learn anything about the visitor, personalize value, qualify intent, or change the CTA.

## Priestley landing-page criteria

### Hook — strong

The page combines a results hook with a frustration hook:

- Result: “The room picks the next song.”
- Frustration: the artist is scanning faces and guessing.

### Value proposition — present, but not a scored insight offer

The page clearly promises to improve ease, excitement, and freedom. Those are three desirable categories, which happens to align well with the supplied formula’s recommendation to name three areas.

However, the visitor is not offered an assessment that will measure and improve those dimensions for their own gigs.

### Credibility — weak

Priestley emphasizes experience, research, real people, and authority. The page has product screenshots and anonymous stats, but no bio, real faces, named customers, or sourced research.

### CTA — strong for product activation, absent for assessment

The CTA is simple, free, and low friction. It does not promise immediate personalized recommendations because no assessment exists.

## Should MySet replace the CTA with a 15-question assessment?

**No—not on the main product page.**

Priestley’s system is excellent for turning cold attention into qualified leads, especially for higher-consideration services. MySet is a free, self-serve product where extra questions could delay activation. For a visitor who already wants the tool, “Create my page” is a better primary action than “Complete an assessment.”

The right application is a separate funnel for cold traffic, outreach, partnerships, and market learning.

## Recommended artist scorecard funnel

### Concept

**The Live Set Engagement Score**

### Landing-page hook

> **How crowd-ready is your live set?**  
> Get a three-minute score across Room Energy, Show Flow, and Booking Proof—plus three practical ways to improve your next gig.

### Value promise

The assessment should measure three dimensions:

1. **Room Energy:** how easily audience members participate and become invested.
2. **Show Flow:** how confidently the artist handles song choices, requests, and gaps.
3. **Booking Proof:** how well the artist documents demand, attendance, and audience response.

### Contact capture

- First name.
- Email.
- Optional phone only if there is a genuine high-touch follow-up path.
- Consent and privacy explanation.

### Ten best-practice questions

Use scaled or multiple-choice questions that produce a meaningful baseline:

1. How often do you perform live in an average month?
2. Before a gig, how clearly do you know which songs fit that venue and audience?
3. How do you currently decide what to play next when the room’s energy changes?
4. Can audience members request songs without interrupting you?
5. Can you control which songs are available for requests or voting on a given night?
6. Do you have a low-friction way for the room to participate without installing an app?
7. Do you have a consistent, comfortable way for audience members to tip?
8. After a show, can you see which songs were most wanted?
9. Can you show a venue credible audience-engagement numbers from previous gigs?
10. Can people who enjoyed the show easily find your profile and future gigs afterward?

### Five qualifying questions

1. **Current situation:** solo artist, duo, band, DJ, venue act, private events, or other.
2. **90-day outcome:** more engaged rooms, more bookings, higher tips, smoother requests, stronger venue pitches, or other.
3. **Biggest obstacle:** audience participation, setup time, technical reliability, losing set control, venue cooperation, or lack of proof.
4. **Preferred help:** self-serve tool, guided setup, done-with-you onboarding, venue partnership, or not sure.
5. **Open response:** “What would make MySet an obvious yes for your next gig?”

### Dynamic result

Show:

- Overall score out of 100.
- Three dimension scores.
- Three personalized observations tied to their answers.
- One immediate action independent of MySet, so the result is genuinely useful.
- A CTA matched to readiness.

### Segmented CTAs

- **High readiness / frequent performer:** “Create your free page now.”
- **High potential / setup concern:** “Book a 15-minute guided setup.”
- **Venue-cooperation concern:** “Get the one-page venue explainer and QR kit.”
- **Low frequency / early curiosity:** “Watch a two-minute real-gig demo.”
- **Venue owner:** route to a separate venue assessment.

### Why this is valuable even if it produces fewer immediate signups

It reveals:

- Which pain is strongest.
- Which customer segment converts.
- Which objections recur.
- Which features influence purchase intent.
- Which leads need support versus self-serve activation.

That is Priestley’s deeper advantage: the funnel does not only convert; it learns.

---

# Part VI — Section-by-section teardown

## 1. Sticky navigation

### Works

- The brand is compact and recognizable.
- The main CTA remains visible during a long scroll.
- Mobile layout does not overflow.

### Fails

- “For venues” introduces the second protagonist immediately.
- “Get your page” is slightly ambiguous until the hero establishes artist context.
- There is no “How it works” or proof anchor for skeptical visitors.

### Recommendation

For the artist page:

- Logo.
- “How it works.”
- “Real gigs” or “Results.”
- Primary CTA: “Create my free page.”
- Put “For venues” in a discreet footer link or audience switcher, not equal visual priority.

## 2. Hero

### Works

- Clear mechanism.
- Strong rhythm.
- Good visual hierarchy.
- Product image makes the interface tangible.
- Two CTAs serve high and low intent.
- Free/no-card/no-download reassurance is excellent.

### Fails

- It does not explicitly say “for live musicians.”
- “The room picks” can trigger loss-of-control anxiety.
- It leads with mechanism rather than emotional outcome.
- There is no proof signal above the fold.
- The hero shows a phone, not a transformed room.

### Recommendation

Add an eyebrow:

> **For live musicians who are tired of guessing**

Test this hero:

> **Turn a distracted room into a crowd that chooses the next song.**  
> Everyone votes from their phone—no app or account. You choose which songs they can see, decide what fits, and leave with proof of what the room wanted.

Buttons:

- **Create my free artist page**
- **Try a live vote**

Reassurance:

> Free forever · no card · set up before your next gig

Proof strip:

> First real gig: 8 people cast 21 votes · no app downloads · the artist kept full setlist control

Only use figures that remain truthful and representative.

## 3. “Forty people, and forty screens” story

### Works

- Best prose on the page.
- Strong internal problem.
- Excellent before/after contrast.
- Highly specific setting and behavior.

### Fails

- The headline may reinforce the fear that MySet creates more screen distraction.
- It is long on mobile.
- It arrives before proof and before the live demo unless the user taps the secondary CTA.

### Recommendation

Retitle:

> **Turn forty screens into one shared decision.**

Compress the scene to roughly half its current length. Preserve the strongest details: the gap, the guessing, and the table watching to see if their song won.

## 4. Live voting demo

### Works

- This is the page’s strongest conversion device.
- It proves ease of use.
- It creates a small commitment.
- It demonstrates reversible voting and vote scarcity.
- It is more persuasive than another paragraph.

### Fails

- It demonstrates the audience view but not the artist payoff.
- The four buttons all have the accessible name “Vote,” so a screen-reader user cannot tell which song each button affects.
- On mobile, the 38-pixel button height is usable but smaller than an ideal 44-pixel touch target.
- The demo does not end with a conversion bridge.

### Recommendation

- Give each button a specific accessible label, e.g. `Vote for Landslide`.
- After the first vote, reveal a small artist-side panel: “Landslide moved to #1. This is what you see on stage.”
- Add a CTA directly under the interaction: “Create your own live queue.”
- Add one line preserving autonomy: “The crowd only sees songs you make available.”

## 5. “Five things happen” feature sequence

### Works

- The five-step progression is easy to follow.
- Each screenshot supports a specific claim.
- Copy is concrete rather than technical.
- Benefits are attached to features.

### Fails

- It is enormous, especially on mobile.
- Five alternating phone screenshots create repetition.
- “None of them need you” overclaims.
- Paid votes and tips appear as normal functionality before limited availability is disclosed.
- The sequence mixes core activation with later-stage marketplace value.

### Recommendation

Compress to three cards or an interactive tabbed walkthrough:

1. **The room scans and votes.** No app or account.
2. **You see the winner and stay in control.** Requests and songs are yours to enable.
3. **The night becomes proof.** Save demand, participation, and future-gig signals.

Move tips, public profiles, and local discovery into “More when you need it” below the core path.

## 6. Ease / Excitement / Freedom

### Works

- This is the clearest benefit architecture on the page.
- It translates software into emotional outcomes.
- The “Why” lines connect claims to mechanisms.

### Fails

- “Freedom” shifts quickly from gig experience to venue pitching.
- The card copy repeats previous sections.
- The icons are generic compared with the otherwise premium visual language.

### Recommendation

Use these three outcomes earlier, directly below the live demo. Shorten each to one sentence and one proof point.

Potential labels:

- **Calm between songs.**
- **A room invested in the winner.**
- **Proof that outlives the gig.**

## 7. Proof block

### Works

- Numbers create specificity.
- The venue-pitch consequence is compelling.
- “Stop telling venues you draw a crowd” is an excellent headline.

### Fails

- Figures are not attributed.
- Animated zero-to-number presentation feels like a marketing statistic rather than an audited event result.
- “12 songs they wanted and didn’t get” sounds like unmet demand, not automatically a benefit.
- “100% from the room, not from you” is not a meaningful outcome metric without explanation.
- Proof appears too late.

### Recommendation

Turn the data into a named case study and an action:

- “12 high-demand songs identified for the next setlist.”
- “314 verified audience votes across three gigs.”
- Include artist, venue, period, and methodology.
- Add a real quote and photo or a short video.
- Pull a compact version near the hero.

## 8. Venue section

### Works

- The venue value proposition is genuinely interesting.
- “Your what’s-on page, written by everyone else” is a strong headline.
- Repeating event automation is concrete.
- The page identifies real venue admin pain.

### Fails

- It hijacks the artist’s story.
- It adds six more features, three more outcomes, two screenshots, another CTA, and another proof claim.
- It creates uncertainty about who MySet is primarily for.
- Venue onboarding and verification deserve their own trust explanation.

### Recommendation

Move this entire section to a dedicated venue landing page. On the artist page, use one narrow strip:

> **Venues can see the same proof.**  
> Your engagement numbers travel with your artist page, so a venue sees evidence instead of another generic bio.  
> [See MySet for venues]

## 9. Pricing

### Works

- Transparent price anchors.
- Free plan reduces risk.
- Tiers correspond to increasing use.
- Candid note acknowledges early-stage status.

### Fails

- No plan CTA.
- Payment availability conflict.
- Unavailable Pro benefits look shipped.
- No annual option or economic comparison—but these are secondary at this stage.
- The page makes a permanent “Always” claim while the product is still evolving.

### Recommendation

For now, simplify:

- **Free:** Use MySet at unlimited gigs. 50 visible songs. 10% of in-app revenue when payments are enabled.
- **Plus:** $10/month. Unlimited visible songs. Keep in-app revenue.
- **Pro:** Hide until the defining features ship, or label every unavailable benefit clearly.

Place “Start free” on every plan and explain that the visitor can upgrade later.

## 10. “Two honest notes”

### Works

- The candid voice earns trust.
- Acknowledging early status is better than pretending maturity.
- It sets realistic expectations about payments and Pro.

### Fails

- The disclosure comes after the page has already sold payments as a live outcome.
- “Everything else works the moment you sign up” is too absolute for an early product.
- “Pro extras marked above” is incorrect because the plan does not visibly mark them.
- A long paragraph forces readers to parse which claims are current.

### Recommendation

Convert it into a visible availability matrix:

| Capability | Status |
|---|---|
| Voting, requests, lyrics, public page, gig history | Available now |
| Tips and paid vote packs | Early access; enabled artist by artist |
| Pro press kit, multi-city, branding, band logins | Coming soon |

Then use:

> MySet is early and being improved in public. The core live-voting experience works now; early-access and forthcoming features are labeled above.

## 11. FAQ

### Works

- Questions are authentic.
- Answers are plain and direct.
- The accordion interaction is familiar and semantically sound.
- “What if nobody votes?” is excellent risk reversal.
- “Can people see my whole setlist?” addresses control.

### Fails

- Two of the most important conversion answers—nobody votes, and artist control—arrive near the bottom.
- There is no privacy/data question despite audience tracking and email-based artist onboarding.
- There is no “Does the crowd control what I must play?” question phrased in the most direct way.
- There is no clear payment-availability FAQ.

### Recommendation

Move key answers into the page body and keep the FAQ for secondary objections. Add:

- “Do I have to play the winning song?”
- “What exactly can the audience see?”
- “What data does MySet collect from voters?”
- “Are tips and paid votes available to me today?”
- “What happens if the connection drops during a show?”

## 12. Final CTA

### Works

- “Your next gig…” creates ethical urgency.
- The CTA is prominent.
- Free/no-card/no-install is repeated.
- Both artist and venue paths are available.

### Fails

- The displayed steps describe account access, not success.
- “I run a venue” reintroduces a second decision at the final conversion moment.
- The CTA still says “Get your page,” which can sound like a profile page rather than a live gig system.

### Recommendation

Use the success plan, then one primary CTA:

> **Set up MySet before your next gig.**  
> Choose your songs. Put the QR where the room can see it. Play with a live read on what they want.  
> **[Create my free artist page]**

Text link below:

> Run a venue? See the venue version →

## 13. Footer, trust, and discoverability

### Current state

The footer contains product-navigation links and “built on Koh Phangan.” It does not expose:

- Privacy policy.
- Terms.
- Contact/support.
- Founder/company identity.
- Product status or changelog.

The live page also lacks a canonical URL, structured data, and a valid `robots.txt` or `sitemap.xml`; requests to the latter two currently return an HTML MySet page because the catch-all route handles those paths. There is no visible client-side analytics script in the inspected page source.

### Recommendation

Add basic trust infrastructure before increasing traffic:

- Privacy.
- Terms.
- Contact/support.
- Status or changelog if building in public is part of the promise.
- Canonical URL.
- Organization/Product/SoftwareApplication structured data where truthful.
- Real `robots.txt` and `sitemap.xml` that bypass catch-all routing.
- First-party event measurement with a clear privacy posture.

---

# Part VII — Copy diagnosis and surgery

| Current line | What it does | Issue | Better direction |
|---|---|---|---|
| “The room picks the next song. You just play it.” | Explains mechanism and ease. | Can imply loss of control; does not lead with room transformation. | Keep as test control; test “Turn a distracted room into a crowd that chooses the next song.” |
| “Your audience votes from their own phones…” | Excellent explanation. | Missing explicit artist control. | Add “You choose which songs they can see—and you always decide what fits.” |
| “Get your page — free” | Clear low-risk action. | “Page” undersells the live system and leads to a sign-in page. | “Create my free artist page” or “Set up my first live vote.” |
| “See how it feels” | Emotional secondary CTA. | Vague. | “Try a live vote.” |
| “Forty people, and forty screens.” | Names the real environment. | May make MySet sound like more phone distraction. | “Turn forty screens into one shared decision.” |
| “Five things happen. None of them need you.” | Strong effort-removal claim. | Not literally true. | “Five things happen while you keep playing.” |
| “Money happens without you asking.” | Great emotional benefit. | Not universally available. | Label early access at first mention or defer the section. |
| “It’s not really about the votes.” | Good reframe. | Arrives after extensive feature explanation. | Move much earlier, immediately after the demo. |
| “Stop telling venues you draw a crowd.” | Excellent commercial hook. | Proof beneath it is unattributed. | Keep it; attach a named, verifiable case study. |
| “Everything the room sees is free. Always.” | Strong pricing promise. | Absolute claim in an early, changing product; includes limited payments. | “The live audience experience is free on every plan.” Then specify current availability. |
| “Your next gig could be the first one they choose.” | Strong future pacing and natural urgency. | “Choose” could again imply artist surrender. | Keep, paired with “You stay in control.” |

## Tone

The voice is a major asset. It is:

- Conversational.
- Specific.
- Slightly irreverent.
- Concrete rather than abstract.
- Candid about the product being early.

Do not replace it with generic SaaS language such as “increase engagement,” “unlock revenue,” or “streamline your workflow.” Those phrases are true but weaker than “No more standing in the gap doing maths.”

The editing goal is not to sanitize the voice. It is to make every vivid sentence serve one story and to remove claims that create factual or strategic drag.

---

# Part VIII — Visual, mobile, and accessibility critique

## Visual identity

### Strengths

- The black/nightlife palette fits the context.
- Pink/orange accent is distinctive and consistent.
- Product screenshots look coherent and real.
- Typography is readable at main sizes.
- Sticky navigation and CTA are useful on a long page.
- Mobile reflow is clean with no horizontal overflow in the tested viewport.

### Weaknesses

- The page is visually dominated by phone screenshots. This proves UI, not emotional outcome.
- There are no real human faces on the sales page despite the product being about a shared live moment.
- The scroll-reveal treatment makes sections appear very dim during entry and causes full-page captures to show large black areas before sections are triggered.
- Small “faint” text has insufficient contrast. The design token is approximately 3.79:1 on black in dark mode and 2.36:1 on the light background in light mode, below the usual 4.5:1 requirement for normal-sized text.
- Several reassurance captions and footer links use that faint token at small sizes.

## Page depth

Observed dimensions:

- Desktop: approximately **11,860 pixels** high at a **997-pixel** viewport—about 12 screens.
- Mobile: approximately **18,344 pixels** high at an **844-pixel** viewport—about 22 screens.
- Visible body copy: approximately **1,766 words**.

Long pages can convert. Priestley explicitly warns that length itself is not the truth; measured behavior is. The problem here is not raw length. It is the amount of repeated explanation before the page supplies credible proof and a focused plan.

## Accessibility positives

- One H1 and a logical H2/H3 hierarchy.
- Meaningful alt text on nine product images.
- Native `<details>` and `<summary>` elements for the FAQ.
- Visible focus styling in the shared CSS.
- Reduced-motion handling.
- No horizontal mobile overflow in the tested viewport.

## Accessibility issues

1. Four demo buttons share the accessible name “Vote.” They need song-specific labels.
2. Small faint copy fails contrast.
3. Demo buttons are 38 pixels tall on the tested mobile layout; a 44-pixel target would be more forgiving in a bar environment.
4. The long page has no skip link.
5. The sticky navigation’s “For venues” link is only 36 pixels high on mobile.
6. Several footer links are only 16 pixels high.

### Recommendation

Prioritize contrast and accessible button names first. Those fixes are small and directly improve comprehension.

---

# Part IX — Measurement and funnel architecture

## The most important Priestley lesson: opinions are not the result

A beautiful critique cannot determine which version converts. The page needs a measurable funnel.

The inspected `about.html` contains no visible client-side analytics or event-tracking integration. Server logs may exist, but they do not replace an intentional event model.

## Required funnel events

At minimum, measure:

1. `landing_view`
2. `hero_primary_cta_click`
3. `hero_demo_cta_click`
4. `demo_first_vote`
5. `proof_viewed`
6. `pricing_viewed`
7. `faq_opened` with question
8. `studio_landed_from_about`
9. `email_submitted`
10. `code_verified`
11. `artist_named`
12. `setlist_started`
13. `first_song_added`
14. `qr_viewed_or_downloaded`
15. `first_show_started`
16. `first_audience_vote`
17. `first_show_completed`
18. `plan_upgraded`

Do not send unnecessary personal data in event payloads. Use anonymous IDs until an account exists, document the data collected, and add privacy controls appropriate to the markets served.

## The conversion rates that matter

### Landing conversion

`email_submitted / unique landing_view`

### Account completion

`code_verified / email_submitted`

### Setup activation

`qr_viewed_or_downloaded / code_verified`

### Product activation

`first_audience_vote / code_verified`

### True value realization

`first_show_completed_with_multiple_voters / code_verified`

### Retention

`second_show_started_within_30_days / first_show_started`

The landing page should not be optimized only for email submissions. A headline that produces more curious signups but fewer first shows is worse.

## Segmentation dimensions

Measure conversion and activation by:

- Performer type.
- Gigs per month.
- Cover/original mix.
- Venue type.
- Traffic source.
- Device.
- Country/city.
- Whether the visitor used the demo.
- Whether the visitor saw proof.
- Stated primary outcome.

This is where Priestley’s questionnaire can add value for cold traffic.

---

# Part X — Recommended new information architecture

## Artist page

### 1. Hero

- Explicit avatar.
- Outcome plus mechanism.
- Artist-control reassurance.
- Primary CTA.
- Live-demo CTA.
- One compact proof signal.

### 2. Live demo

- Audience vote.
- Immediate artist-side payoff.
- CTA under interaction.

### 3. Three outcomes

- Calm.
- Energy.
- Proof.

### 4. Three-step plan

- Create and choose songs.
- Display QR.
- See demand and keep the results.

### 5. Named real-gig case study

- Person.
- Venue.
- Before/after experience.
- Metrics.
- Quote or video.

### 6. Core product controls

- Artist controls visible songs.
- Requests optional.
- No audience accounts.
- Connection recovery.

### 7. Offer and pricing

- Current capabilities only.
- Availability labels.
- CTA inside every plan.

### 8. FAQ

- Control.
- Nobody votes.
- Wi-Fi.
- Originals.
- Privacy.
- Payments availability.

### 9. Final CTA

- Next-gig urgency.
- One artist action.
- Venue path as a text link.

## Venue page

Give venues their own complete story:

- Character: venue operator/manager.
- Problem: stale listings, uncertain bookings, scattered inbound act pitches.
- Outcome: current events page, evidence-backed booking, stronger local discovery.
- Proof: named venue and populated calendar example.
- Plan: claim page, verify venue, publish recurring events.
- CTA: claim venue.

## Scorecard acquisition page

Use a third route for the Priestley funnel:

- “Live Set Engagement Score.”
- 15 questions.
- Dynamic results.
- Segmented next step.
- Direct path back to product activation.

---

# Part XI — Recommended copy blueprint

This is a structural draft, not final copy. It should be validated with real artists and tested against the current page.

## Hero

**Eyebrow**  
For live musicians who are tired of guessing

**Headline**  
Turn a distracted room into a crowd that chooses the next song.

**Subhead**  
Everyone votes from their phone—no app, account, or download. You choose which songs they can see, decide what fits, and leave with proof of what the room wanted.

**Primary CTA**  
Create my free artist page

**Secondary CTA**  
Try a live vote

**Reassurance**  
Free forever · no card · set up before your next gig

**Proof**  
At MySet’s first live gig, eight people cast twenty-one votes. Use a stronger approved proof point when available.

## Reframe

**Headline**  
It is not another screen. It is one shared decision.

**Body**  
The room is already on its phones. MySet turns those phones into a live queue everyone can influence. They watch the winner, argue for their song, and pay attention when it starts.

## Demo bridge

**Instruction**  
Vote for a song. Watch the room’s queue move.

**After interaction**  
That is what the audience sees. On your screen, the winner rises to the top. You still decide what fits the moment.

**CTA**  
Create my own live queue

## Outcomes

**Calm between songs**  
Stop scanning forty faces. The strongest signal is already ranked.

**A crowd invested in the winner**  
People pay attention to a choice they helped make.

**Proof after the room clears**  
Keep the numbers and songs that mattered when you pitch your next venue.

## Plan

1. Choose the songs the room can see.
2. Put your QR where people can scan it.
3. See what they want, play what fits, and keep the night’s results.

## Risk reversal

If nobody votes, nothing breaks. Play the set you already planned.

## Final CTA

**Headline**  
Make your next gig your first measured gig.

**Body**  
Create your page now, add your songs, and put the QR out at the next show.

**CTA**  
Create my free artist page

**Venue link**  
Run a venue? See MySet for venues →

---

# Part XII — Experiment roadmap

## Test 0: instrument before changing

### Hypothesis

Reliable event data will reveal whether the main leak is page-to-email, email-to-code, or setup-to-first-show.

### Success metric

Complete funnel visibility from landing view to first audience vote.

## Test 1: fix CTA handoff language

### Change

Replace “Sign in to run your show” with “Create or open your artist page.”

### Hypothesis

New visitors will be less likely to believe they reached a returning-user page.

### Primary metric

Email submission rate from `/studio` visitors arriving from `/about`.

### Guardrail

Returning-user completion rate must not decline.

## Test 2: add artist-control reassurance above the fold

### Change

Add: “You choose which songs they can see—and you always decide what fits.”

### Hypothesis

This will reduce the fear that audience voting removes artistic control.

### Primary metric

Hero CTA click-to-email completion.

## Test 3: add named proof near the hero

### Change

Add one verified real-gig result and quote below the hero.

### Hypothesis

Perceived likelihood will increase without requiring more explanation.

### Primary metric

Unique landing view to email submission.

### Guardrail

No decrease in demo interaction rate.

## Test 4: remove the venue section from the artist page

### Change

Replace the full venue section with a short venue-proof bridge and separate link.

### Hypothesis

Artist signup and activation will rise because the story stays focused.

### Primary metric

Artist email submission and first-show activation.

### Secondary metric

Venue page visits and venue claims from the separate venue route.

## Test 5: current hero vs outcome-led hero

### Control

“The room picks the next song. You just play it.”

### Variant

“Turn a distracted room into a crowd that chooses the next song.”

### Hypothesis

The outcome-led version will improve qualified signup without reducing understanding.

### Primary metric

First audience vote per unique landing visitor—not CTA clicks alone.

## Test 6: compact vs long page

### Change

Use the recommended nine-section artist structure and three-card feature summary.

### Hypothesis

The compact page will preserve understanding while moving more visitors to proof, pricing, and CTA.

### Metrics

- Landing-to-email.
- Email-to-first-vote.
- Time to CTA.
- Proof exposure.
- Scroll depth.

## Test 7: direct product CTA vs scorecard CTA for cold traffic

Do not test this on all traffic. Split only cold ad or outbound traffic.

### Variant A

Create free page.

### Variant B

Discover your Live Set Engagement Score.

### Success metric

Cost per activated artist, not cost per lead.

The scorecard may produce more leads but fewer first shows; that would not be a win.

---

# Part XIII — Priority order

## P0 — fix before sending serious traffic

1. **Instrument the full conversion and activation funnel.**
2. **Repair promise integrity:** label payment early access and visibly mark or remove unshipped Pro features.
3. **Fix the `/studio` new-user handoff.**
4. **Add artist-control reassurance near the hero and demo.**
5. **Add one named, verifiable real-gig proof element near the top.**
6. **Add privacy, terms, and contact links before collecting more traffic and emails.**

## P1 — highest conversion leverage

1. Split artist and venue stories.
2. Compress the five-feature sequence.
3. Move the three emotional outcomes directly after the demo.
4. Replace signup logistics with a three-step success plan.
5. Add pricing-card CTAs.
6. Move “If nobody votes, nothing breaks” near the first CTA.
7. Add a real-gig human visual or short video.

## P2 — polish and distribution

1. Fix faint-text contrast.
2. Give demo buttons song-specific accessible labels and larger touch targets.
3. Add a skip link.
4. Add canonical URL and structured data.
5. Serve real `robots.txt` and `sitemap.xml` files outside the catch-all route.
6. Add better social-sharing metadata.
7. Build the separate Priestley-style scorecard funnel.

---

# Final assessment

Claude produced copy with genuine feel. The page understands the physical and emotional texture of a mediocre bar gig better than most software pages understand their customers. The hook is clear. The no-install decision is excellent. The demo is real. The prose has bite. The page is visually coherent and mobile-capable.

The next improvement is not “better copy” in the abstract.

It is strategic subtraction and evidentiary addition:

- **Subtract** the venue story from the artist’s decision path.
- **Subtract** repeated feature explanation.
- **Subtract** unqualified absolutes and unavailable promises.
- **Add** proof from a real musician and real room.
- **Add** the artist’s control explicitly.
- **Add** a plan for success, not merely signup.
- **Add** measurement from landing view to first live vote.

Hormozi would say the page has already done excellent work on speed and effort, but it must dramatically increase perceived likelihood. Miller would say the page has a compelling hero and problem but changes heroes, underplays the guide, and gives the wrong kind of plan. Priestley would say the landing page is only the front edge of a system; without measurement, qualification, personalized results, and routing, MySet is learning far less from its traffic than it could.

The page does not need more cleverness. It needs a narrower story, harder proof, more exact promises, and a conversion loop that reaches all the way to a successful gig.
