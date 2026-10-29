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

// The three product packages (keys stay essentials/performance/longevity in the database; names show in the app).
// daily: the checklist members see on Today (one tap each). price: shown on the Plan tab ('' to hide).
// Product lines describe what each product is. No health or medication claims here.
export const PACKAGES = {
  essentials: {
    name: 'Ease',
    tagline: 'The everyday foundation.',
    price: '$131.25',
    products: [
      { name: 'Prebiotic Fiber', how: 'Soluble fiber to help you reach your daily fiber goal.' },
      { name: 'All-in-One Meal Powder', how: 'A drinkable meal: 20 g plant protein and 6 g fiber per shake.' },
    ],
    daily: ['Prebiotic fiber', 'Meal shake'],
    perks: ['Prebiotic Fiber + All-in-One Meal Powder', 'Your package checklist in the app', 'Reorder reminders'],
    reorderDays: 30,
  },
  performance: {
    name: 'Endure',
    tagline: 'Foundation plus strength support.',
    price: '$193.25',
    products: [
      { name: 'Prebiotic Fiber', how: 'Soluble fiber to help you reach your daily fiber goal.' },
      { name: 'All-in-One Meal Powder', how: 'A drinkable meal: 20 g plant protein and 6 g fiber per shake.' },
      { name: 'XS Creatine + HMB', how: 'Creatine and HMB to pair with your strength training.' },
    ],
    daily: ['Prebiotic fiber', 'Meal shake', 'Creatine + HMB'],
    perks: ['Everything in Ease, plus XS Creatine + HMB', 'Kept included', 'Kept Live sessions'],
    reorderDays: 30,
  },
  longevity: {
    name: 'Elevate',
    tagline: 'The complete program.',
    price: '$312.25',
    products: [
      { name: 'Prebiotic Fiber', how: 'Soluble fiber to help you reach your daily fiber goal.' },
      { name: 'All-in-One Meal Powder', how: 'A drinkable meal: 20 g plant protein and 6 g fiber per shake.' },
      { name: 'Double X Multivitamin', how: '22 vitamins and minerals plus 22 plant nutrients.' },
      { name: 'Muscle Multiplier', how: 'A light, sugar-free essential amino acid drink.' },
      { name: 'XS Creatine', how: 'Creatine to pair with your strength training.' },
    ],
    daily: ['Prebiotic fiber', 'Meal shake', 'Double X multivitamin', 'Muscle Multiplier', 'Creatine'],
    perks: ['Everything in Ease, plus Double X, Muscle Multiplier and Creatine', 'Kept included', 'Monthly 1:1 with your concierge'],
    reorderDays: 30,
  },
};

// Bloodwork add-on: offered by asking your concierge (no direct sign-up link in the app).
export const VALDURA = {
  title: 'Understand your bloodwork',
  body: 'Add Valdura, a separate app that explains your lab results in plain language and tracks them over time. Ask your concierge about adding it. Amway members may qualify for a member rate.',
};
