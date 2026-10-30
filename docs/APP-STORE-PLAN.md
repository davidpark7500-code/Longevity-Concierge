# App store submission plan (ON STANDBY)

Status: waiting on David's LLC, D-U-N-S number and developer accounts. Nothing below is applied yet.

## Rule
Changes apply to the **app store builds only** (Capacitor, `NATIVE === true` in `src/native.js`).
The website, flyers, one-pagers, PDFs, videos and other promo material stay exactly as they are.

## Hide in the app build only
1. "30% off peptides" perk (`MEMBERSHIP.perks` in `src/config.js`) on every package card.
2. NAD+ article ("NAD+: what it is and what the research says"). Filter it out of Learn when NATIVE. It stays published on the website and can be re-enabled in the app later.
3. Coach quick-question chip "Is my dose right?" -> replace with "Quick dinner ideas" (app build).
4. Valdura bloodwork add-on tile on Plan and the "50% off the Valdura app" perk.

## Keep as is
- Articles: protein while losing weight, 10 questions for your provider visit, and the rest.
- Disclaimers, coach safety rules (not user-visible), packages, the Circle, concierge, Terms/Privacy (open from the website).

## Done (Oct 30, 2026)
- Community safety (Apple 1.2): Report and Block on every post, blocked list with Unblock in Account, Reported posts in Admin with Remove post / Keep it, email alert to admins on each report. Terms say zero tolerance.
- The Circle in the store apps: no package gating. No locked tiles, no Circle Live links, no members-only challenges or private group in the app. Members get the weekly call and group outside the app. The website is unchanged.
- Stripe checkout/portal code removed (app and server).
- Privacy policy and terms name Holistic Creative Studios LLC and cover the phone apps. Account deletion page: /delete-account.html (for Google Play).
- Reviewer sign-in: review@holisticcreativestudios.com. Typing that email skips the code email and the code box takes a password instead. David creates the user in Supabase (Authentication > Users > Add user, auto-confirm) with a password he picks, and puts it in the review notes.

- App-only content hidden when NATIVE: 30% peptides and 50% Valdura perks, Valdura add-on tile, NAD+/peptide/GLP-1 articles in Learn, "Is my dose right?" chip (now "Quick dinner ideas"), peptide and Valdura words in the Plan disclaimer. Website unchanged.
- Android release workflow (.github/workflows/android-release.yml): manual, builds a signed .aab. Still needs the 4 signing secrets added in GitHub (GitHub blocks setting them from Claude's sandbox): generate the upload key on submission day, David pastes the values in Settings > Secrets and variables > Actions. Enroll in Play App Signing so a lost upload key can be reset.

## Store setup
- Apple: company enrollment needs the LLC's legal name (Apple does not accept DBAs) + D-U-N-S. $99/year.
- Google Play: organization account, $25 one-time (organization accounts skip the 12-tester / 14-day closed test).
- Category: Health & Fitness (primary), Lifestyle (secondary). Listing language: habit and accountability app.
- Still to do at submission: store screenshots and description, privacy questionnaires, signing keys (Android keystore, Apple certificates in GitHub secrets), TestFlight.

## Already built
- iOS and Android projects (Capacitor 8), icons and splash, daily reminder notifications, native back button/links/status bar.
- GitHub Actions: "Android test build" (APK on every push) and "iOS build check" (manual).
