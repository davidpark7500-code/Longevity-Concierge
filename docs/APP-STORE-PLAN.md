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

## Add (app and website)
- Community safety (Apple guideline 1.2 for user posts): Report a post, Block a user, admin Remove post, reported posts listed in admin.

## Store setup
- Apple: company enrollment needs the LLC's legal name (Apple does not accept DBAs) + D-U-N-S. $99/year.
- Google Play: organization account, $25 one-time (organization accounts skip the 12-tester / 14-day closed test).
- Category: Health & Fitness (primary), Lifestyle (secondary). Listing language: habit and accountability app.
- Still to do at submission: store screenshots and description, privacy questionnaires, signing keys (Android keystore, Apple certificates in GitHub secrets), TestFlight.

## Already built
- iOS and Android projects (Capacitor 8), icons and splash, daily reminder notifications, native back button/links/status bar.
- GitHub Actions: "Android test build" (APK on every push) and "iOS build check" (manual).
