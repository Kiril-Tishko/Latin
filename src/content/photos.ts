// Photos the people of the messenger send now and then. They live around
// AD 100, so their "photos" are what their world looked like in its own art:
// wall paintings, mosaics and the things they used, from museums that share
// them freely (The Met's Open Access, CC0). Claude picks one when it fits; the
// page shows it in the chat with its caption, and a tap opens it with what it is
// and where it is from. The images are files published beside the page
// (src/content/photos/*.webp, made by scripts/content/photos.py; the build
// copies them to dist/photos), so the page stays small.

export interface Photo {
  id: string;
  /** What it shows, as the sender would see it (English), for Claude and the learner. */
  en: string;
  /** What the picture really is: the object, where and when it was made. */
  what: string;
  /** Who would send it: the friends' ids, or "any" (strangers too). */
  who: string[] | "any";
  /** Where the picture comes from (museum, licence). */
  credit: string;
}

const met = (id: number) => `The Met, New York, object ${id} (Open Access, CC0)`;

export const PHOTOS: Photo[] = [
  { id: "lyre", en: "a lady playing the lyre, a little girl behind her chair: a wall painting in a rich friend's house", what: "Wall painting from a villa at Boscoreale near Pompeii, about 50–40 BC", who: ["iulia", "lucius"], credit: met(247009) },
  { id: "earring", en: "a gold earring with little golden grapes", what: "Roman gold earring, 2nd–3rd century AD", who: ["iulia"], credit: met(242689) },
  { id: "perfume", en: "a little blue glass bottle of perfume", what: "Roman glass perfume bottle, 1st century AD", who: ["iulia", "claudia"], credit: met(239768) },
  { id: "comb", en: "a silver comb and a hairpin on the table", what: "Silver comb and pin, mid-1st century BC", who: ["iulia"], credit: met(254591) },
  { id: "masks", en: "two theatre masks carved in marble, a funny old man and a girl", what: "Marble disk with two theatre masks, 1st century AD", who: ["iulia", "lucius"], credit: met(248802) },
  { id: "actor-lamp", en: "a clay lamp shaped like a comic actor lying on a couch", what: "Terracotta hanging lamp in the form of a comic actor, 2nd century AD", who: ["iulia", "marcus", "lucius"], credit: met(250236) },
  { id: "ink", en: "an ink pot and a bronze stylus on the desk", what: "Terracotta inkwell and bronze stylus, 1st–2nd century AD", who: ["marcus", "claudia", "lucius"], credit: met(252501) },
  { id: "coin", en: "a bronze coin with the emperor Trajan's head", what: "Bronze sestertius of Trajan, AD 103–111", who: ["marcus", "gaius"], credit: met(248043) },
  { id: "die", en: "a bone die on the table (one throw more…)", what: "Roman ivory die, 1st–3rd century AD", who: ["marcus", "lucius"], credit: met(246446) },
  { id: "gladiator-cup", en: "a glass cup with gladiators fighting all round it", what: "Glass cup with gladiators, about AD 50–80", who: ["marcus"], credit: met(245397) },
  { id: "goat", en: "a goat leaping (in plaster on a wall, but it looks just like mine)", what: "Stucco relief with a goat, 1st century AD", who: ["gaius"], credit: met(252549) },
  { id: "tied-goat", en: "a goat with its legs tied, so it cannot run off again", what: "Marble statue of a bound goat, 1st–2nd century AD", who: ["gaius"], credit: met(248270) },
  { id: "grapes", en: "a dark glass bottle shaped like a bunch of grapes", what: "Glass bottle shaped like a bunch of grapes, 1st century AD", who: ["gaius", "lucius"], credit: met(245388) },
  { id: "cup", en: "a glass cup for wine", what: "Roman glass cup, mid-1st century AD", who: ["gaius", "lucius", "marcus"], credit: met(239878) },
  { id: "boat-lamp", en: "a clay lamp shaped like a ship", what: "Terracotta oil lamp in the shape of a boat, 2nd century AD", who: ["claudia"], credit: met(250457) },
  { id: "fish", en: "a glass bottle shaped like a fish, from the market in Ostia", what: "Glass bottle in the shape of a fish, 1st–2nd century AD", who: ["claudia"], credit: met(249494) },
  { id: "pig-rattle", en: "a little clay pig: a child's rattle", what: "Terracotta rattle in the form of a pig, 2nd century AD", who: ["claudia"], credit: met(250257) },
  { id: "girl-dog", en: "a little bronze girl hugging a dog", what: "Bronze statuette of a girl holding a dog, 1st century BC–2nd century AD", who: ["claudia", "iulia"], credit: met(248754) },
  { id: "night-lamp", en: "a glass oil lamp, burning late into the night", what: "Glass oil lamp, second half of the 1st century AD", who: ["lucius"], credit: met(239871) },
  { id: "galatea", en: "a painting of the giant Polyphemus, hopelessly in love with the sea nymph Galatea", what: "Wall painting from the imperial villa at Boscotrecase, last decade of the 1st century BC", who: ["lucius", "iulia"], credit: met(250946) },
  { id: "lantern-boy", en: "a boy asleep with his lantern, waiting for his master", what: "Marble statuette of a slave boy with a lantern, 1st or 2nd century AD", who: ["lucius"], credit: met(251415) },
  { id: "dining-room", en: "the painted walls of a rich dining room, with garlands and masks", what: "Wall painting from a villa at Boscoreale, about 50–40 BC", who: "any", credit: met(247008) },
  { id: "bedroom", en: "a rich man's bedroom, painted all over with gardens and towns", what: "Bedroom (cubiculum) from a villa at Boscoreale, about 50–40 BC", who: "any", credit: met(247017) },
  { id: "mosaic", en: "a mosaic floor with a face in the middle", what: "Roman mosaic floor panel, 2nd century AD", who: "any", credit: met(253565) },
  { id: "dog", en: "a dog lying down, keeping watch", what: "Bronze statuette of a dog, 2nd–3rd century AD", who: "any", credit: met(255121) },
];

export const PHOTO_BY_ID = new Map(PHOTOS.map((p) => [p.id, p]));

/** Where a photo's image is: a small WebP published next to the page (photos/<id>.webp). */
export const photoSrc = (id: string): string | undefined => (PHOTO_BY_ID.has(id) ? `photos/${id}.webp` : undefined);

/** The photos someone could send: their own, then those anyone could, never one sent lately. */
export function photosFor(who: string, stranger: boolean, recent: string[] = []): Photo[] {
  return PHOTOS.filter((p) => !recent.includes(p.id) && photoSrc(p.id) && (p.who === "any" || (!stranger && p.who.includes(who))));
}
