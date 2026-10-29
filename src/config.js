// Business settings in one place. Edit here; no other code changes needed.

// Your concierge (shown on Today and Plan). contact: sms:, tel:, mailto: or https:// link.
export const CONCIERGE = {
  name: '',                          // leave '' to say "your concierge" everywhere
  contact: 'sms:+18168774200',       // PLACEHOLDER (David's number). Each concierge's own number replaces this.
  contactLabel: 'Text your concierge',
};

// Community naming. Change the words here and the whole app follows.
export const NAMES = {
  tab: 'Check-In',          // bottom tab
  feed: 'The Check-In',     // public feed everyone can post to
  challenges: 'Challenges', // goal groups
  paid: 'Circle',           // paid inner circle ("Circle member", "Circle Live")
  paidThe: 'the Circle',    // with the article ("Join the Circle")
  paidLine: 'The members-only inner circle for people who follow through.',
};

// The three product packages (keys stay essentials/performance/longevity in the database; names show in the app).
// daily: the checklist members see on Today (one tap each). retail: product total per monthly order (before membership).
// Product lines describe what each product is. No health or medication claims here.
export const PACKAGES = {
  essentials: {
    name: 'Ease',
    tagline: 'The everyday foundation.',
    retail: 131.25,
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
    retail: 193.25,
    products: [
      { name: 'Prebiotic Fiber', how: 'Soluble fiber to help you reach your daily fiber goal.' },
      { name: 'All-in-One Meal Powder', how: 'A drinkable meal: 20 g plant protein and 6 g fiber per shake.' },
      { name: 'XS Creatine + HMB', how: 'Creatine and HMB to pair with your strength training.' },
    ],
    daily: ['Prebiotic fiber', 'Meal shake', 'Creatine + HMB'],
    perks: ['Everything in Ease, plus XS Creatine + HMB', 'The Circle included', 'Circle Live sessions'],
    reorderDays: 30,
  },
  longevity: {
    name: 'Elevate',
    tagline: 'The complete program.',
    retail: 312.25,
    products: [
      { name: 'Prebiotic Fiber', how: 'Soluble fiber to help you reach your daily fiber goal.' },
      { name: 'All-in-One Meal Powder', how: 'A drinkable meal: 20 g plant protein and 6 g fiber per shake.' },
      { name: 'Double X Multivitamin', how: '22 vitamins and minerals plus 22 plant nutrients.' },
      { name: 'Muscle Multiplier', how: 'A light, sugar-free essential amino acid drink.' },
      { name: 'XS Creatine', how: 'Creatine to pair with your strength training.' },
    ],
    daily: ['Prebiotic fiber', 'Meal shake', 'Double X multivitamin', 'Muscle Multiplier', 'Creatine'],
    perks: ['Everything in Ease, plus Double X, Muscle Multiplier and Creatine', 'The Circle included', 'Monthly 1:1 with your concierge'],
    reorderDays: 30,
  },
};

// The package to spotlight on the Plan tab. badge: keep it factual ("Most popular" only once it's true).
export const FEATURED = { key: 'performance', badge: 'Best value' };

// Loyalty membership, built into every package price.
// Monthly price shown = retail + fee - discount (the discount only applies when the product order is at least minOrder).
export const MEMBERSHIP = {
  name: 'Loyalty membership',
  fee: 20,
  discount: 40,
  minOrder: 150,        // the $40 off only applies to product orders of $150+ (so not Ease)
  perks: ['$40 off your monthly order', 'Free shipping', '$50 in free product', '30% off Avellum peptides', '50% off the Valdura app'],
};
export function monthly(pkg) {
  const off = pkg.retail >= MEMBERSHIP.minOrder ? MEMBERSHIP.discount : 0;
  return { total: pkg.retail + MEMBERSHIP.fee - off, off, retail: pkg.retail, fee: MEMBERSHIP.fee, qualifies: off > 0 };
}
export const money = n => '$' + n.toFixed(2);

// Bloodwork add-on: offered by asking your concierge (no direct sign-up link in the app).
export const VALDURA = {
  title: 'Understand your bloodwork',
  body: 'Add Valdura, a separate app that explains your lab results in plain language and tracks them over time. Loyalty members get 50% off. Ask your concierge about adding it.',
};
