// Business settings in one place. Edit here; no other code changes needed.

// Your concierge (shown on Today and Plan). contact: sms:, tel:, mailto: or https:// link.
export const CONCIERGE = {
  name: 'David',
  contact: '',              // e.g. 'sms:+18165551234'. Leave '' to hide the button until you add it.
  contactLabel: 'Text David',
};

// Community naming. Change the words here and the whole app follows.
export const NAMES = {
  tab: 'Check-In',          // bottom tab
  feed: 'The Check-In',     // public feed everyone can post to
  pacts: 'Pacts',           // goal groups
  kept: 'Kept',             // paid inner circle
  keptLine: 'The members-only group for people who follow through.',
};

// The three product packages. PRODUCTS ARE PLACEHOLDERS until David sends the real lists.
// daily: the checklist members see on Today (one tap each). Keep each to a few words.
// reorderDays: how long one order lasts, for the reorder reminder.
export const PACKAGES = {
  essentials: {
    name: 'Essentials',
    tagline: 'The everyday basics.',
    products: [
      { name: '[Product 1]', how: 'As directed on the label' },
      { name: '[Product 2]', how: 'As directed on the label' },
    ],
    daily: ['Morning protein shake', 'Daily fiber'],
    perks: ['Your package checklist in the app', 'Reorder reminders', 'Add Kept any time'],
    reorderDays: 30,
  },
  performance: {
    name: 'Performance',
    tagline: 'Basics plus energy and hydration.',
    products: [
      { name: '[Product 1]', how: 'As directed on the label' },
      { name: '[Product 2]', how: 'As directed on the label' },
      { name: '[Product 3]', how: 'As directed on the label' },
    ],
    daily: ['Morning protein shake', 'Multivitamin', 'Hydration mix'],
    perks: ['Kept included', 'Kept Live group calls', 'Members-only pacts'],
    reorderDays: 30,
  },
  longevity: {
    name: 'Longevity',
    tagline: 'The full program.',
    products: [
      { name: '[Product 1]', how: 'As directed on the label' },
      { name: '[Product 2]', how: 'As directed on the label' },
      { name: '[Product 3]', how: 'As directed on the label' },
      { name: '[Product 4]', how: 'As directed on the label' },
    ],
    daily: ['Morning protein shake', 'Multivitamin', 'Omega-3', 'Protein snack'],
    perks: ['Kept included', 'Monthly 1:1 with your concierge', 'First access to workshops'],
    reorderDays: 30,
  },
};

// Bloodwork add-on: offered by asking your concierge (no direct sign-up link in the app).
export const VALDURA = {
  title: 'Understand your bloodwork',
  body: 'Add Valdura, a separate app that explains your lab results in plain language and tracks them over time. Ask your concierge about adding it. Amway members may qualify for a member rate.',
};
