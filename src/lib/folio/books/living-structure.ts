import type { Book } from "../types";

const c = (id: string, title: string, body: string): Book["chapters"][number] => ({
  id,
  title,
  html: `<p class="chapter-kicker">Living Structure · ${title}</p><h2>${title}</h2>${body}`,
});

export const livingStructure: Book = {
  id: "living-structure",
  title: "Living Structure",
  author: "Folio Field Notes",
  year: "2026",
  description:
    "An original companion to the pattern tradition: how rooms, streets, sentences, and software become alive. Written for the Daylight, not a pirate of any copyrighted book.",
  coverLabel: "I",
  source: "bundled",
  chapters: [
    c(
      "ls-1",
      "The feeling in a room",
      `<p>There is a feeling you already know, and you have never been taught it. You walk into one kitchen and your shoulders drop. You walk into another, same square footage, same appliances, and you want to leave. Architects have names for style. What you are noticing is older than style. Call it living structure, if you need a name. The name does not matter. The feeling does.</p>
<p>A living structure is not a pretty object. Pretty objects often feel dead. A living structure is a place (or a page, or a tool) that has enough inner life that you can stay with it. You can think in it. You can be sad in it without being ejected. Children will find a corner of it and claim it without being asked.</p>
<p>The Daylight in your hands is an attempt at this. Paper that refreshes like a screen. A proportion that sits in the lap like a folio, not a phone. The machine is trying to disappear so that a sentence can appear. That is the same problem a good room is solving.</p>
<p>This book is not a catalog of someone else’s patterns. It is a field guide for noticing. You will mark passages because a person is named, because a book is recommended, because a sentence suddenly explains a room you have lived in for ten years. The marks are the point. Reading without marking is tourism.</p>
<p>If you take one instruction from these pages, take this: when a sentence makes your body change — a small heat in the chest, a tightness, a laugh you did not plan — mark it immediately. Do not wait to be a better note-taker. Double-tap the sentence. Speak into it if speaking is faster than typing. Your future self is not a scholar. Your future self is tired, and needs the heat back.</p>`,
    ),
    c(
      "ls-2",
      "Centers",
      `<p>Look at anything that feels alive — a window seat, a well-set paragraph, a courtyard with a tree — and you will find a center. A center is a zone of attention that holds. It is not the geometric middle. It is the place the eye, and then the body, agrees to rest.</p>
<p>A page has a center when the measure of the line is not too wide, when the margins are generous enough to breathe, when the type is dark enough to be ink and not a suggestion of ink. Too wide a line and the eye panics at the return. Too tight a margin and the words feel imprisoned. These are not aesthetic preferences. They are the physiology of reading.</p>
<p>A room has a center when there is a place to sit that faces something worth facing: a fire, a window with a tree, a table already laid. Open-plan rooms often fail because they have square footage and no center. You float. Floating is exhausting.</p>
<p>In software the same failure has a name: the dashboard. Twelve cards, all equally loud, no place to rest. A living interface has one center and a few supporting ones, like planets. The rest is quiet.</p>
<p>When you mark a passage about a person, you are naming a center in the social field of the book. When you mark a place, you are pinning a center in geography. Tags exist because color-coding is a poor language on a gray page, and because “yellow highlight” never meant <em>this is about Maya</em> or <em>this is the courtyard in Kyoto</em>.</p>
<blockquote>A center is not added on. It is grown by the things around it agreeing to serve it.</blockquote>
<p>Practice: tonight, in whatever room you are in, find the actual center. Not the television. The place a guest would naturally sit if they trusted you. If you cannot find it, the room is not finished. Neither is the page, if your eye has nowhere to land.</p>`,
    ),
    c(
      "ls-3",
      "Fifteen ways a thing can be alive",
      `<p>You do not need a system of fifteen properties to feel when something is alive. You already feel it. The list is only useful when you are stuck, when a page or a room is almost-right and you cannot say why. Then it helps to have names for the ways life shows up.</p>
<p>Levels of scale: a good street has the city, the block, the doorway, the door handle. A good book has the volume, the chapter, the paragraph, the sentence, the word. If any level is missing, the whole feels thin. Folio paginates so that the page itself becomes a level of scale — a physical unit you can turn — instead of an infinite scroll that has only two levels: the site, and the now.</p>
<p>Thick boundaries: a courtyard needs walls with depth, not a line on a plan. A highlight needs a little space around the words, not a neon streak. On a paper display, the mark is a wash, like pencil on laid paper. The boundary is the sentence.</p>
<p>Alternating repetition: windows, then wall, then window. Sentence, then breath, then sentence. If every paragraph is the same length, the prose dies of equality. If every highlight is the same tag, the tags die too.</p>
<p>Positive space: the leftover shape must also be a shape. Margins are not waste. The gutter of a book is where your thumb lives. Design that “uses every pixel” is the open-plan room again.</p>
<p>Local symmetries, not a global grid. Deep interlock, so parts need each other. Contrast, so the ink is actually dark. Gradients that ease, not jump. Roughness — a little noise in the paper, a little irregularity in the rhythm — so the thing does not feel like it was extruded.</p>
<p>The inner quiet is the last one, and the one people skip. A living page does not shout its features at you. Chrome hides. The paperclip waits. When you are inside a sentence, the machine should have the manners to be furniture.</p>
<p>You will not apply these as a checklist while reading Marcus Aurelius. You will feel them fail when a reader app puts a floating toolbar over the words you just found. That failure is information. Mark it, if you want, as a question.</p>`,
    ),
    c(
      "ls-4",
      "A pattern is a rule you can use twice",
      `<p>A pattern is not a picture of a famous building. A pattern is a rule of thumb that has been true in enough places that you can spend it. <em>Give every room a window seat.</em> <em>Put the kitchen on the way in, not at the end of a hall.</em> <em>Let a chapter open with a short line, then a long breath of prose.</em></p>
<p>The useful patterns in a life of reading are almost embarrassingly small:</p>
<p>Keep the book you are actually reading on the first shelf, not in a database. Continue is a bigger button than Browse.</p>
<p>Mark the sentence, not the vibe. A highlight that spans three pages is a souvenir. A sentence you can lift is a tool.</p>
<p>Speak the note if the note is a feeling. Feelings die when they have to pass through a keyboard. A voice note saved beside a paragraph is the closest we have to being in the room again. You will hear that you were excited, or confused, or about to cry, and that information is not in the transcript.</p>
<p>Name people. Books are full of them, and they evaporate. A tag called Person, with a face, is a way of keeping a social world inside a volume.</p>
<p>When someone recommends a book, tag it as a book, immediately, even if you will not fetch it for a year. Future-you is a librarian with amnesia.</p>
<p>Do not build a second brain. Build a first one that you will actually open. The graveyard of read-later apps is full of perfect taxonomies and zero rereading. Folio’s prejudice is toward the next page, and toward the handful of marks that still put a charge in you.</p>
<blockquote>A pattern that needs a manual is not a pattern. It is a product.</blockquote>
<p>If you invent a tag, invent it because you have already used the idea three times with your hands, not because a system offered you a blank field. Suggestion can help — a quiet clustering of your marks — but the human names the world. The model only sorts the mail.</p>`,
    ),
    c(
      "ls-5",
      "How to read a place",
      `<p>Walk slowly enough that the street can finish its sentence. Most of us walk as if the city were a loading bar. Living structure appears at walking speed, and then at sitting speed. You cannot diagnose a plaza from a scooter.</p>
<p>Start with the body. Where do people actually stand? Not where the plan says they should. The scuff on a step is a more honest drawing than the rendering. In a book, the scuff is the sentence you have already marked twice without meaning to. Reread that one. It is your plaza.</p>
<p>Then look for the centers, nested. A good café is a room inside a street inside a district. A good chapter is a claim inside an argument inside a life. If you cannot say what the chapter is a center of, the chapter is probably a magazine essay wearing a book’s clothes.</p>
<p>Then look for repair. Living structure is not born finished. It is repaired in public. A patched stair, a rewritten paragraph, a house that grew a porch because a child needed shade. Dead structure is afraid of the patch. It would rather demolish.</p>
<p>This is why a reader that forgets your marks is a kind of demolition. The annotations are the porch. They are how the book grew to fit you. Sync exists so that the porch is still there when you change chairs — from the ten-inch folio in the garden to the phone on the train.</p>
<p>Christopher Alexander spent a life trying to say this in buildings. His books are still in print, and still in copyright, and you should buy them from a shop if they are the ones you want. What you have here is a walk in the same weather, not a photocopy of his map. Hold <a href="https://en.wikipedia.org/wiki/Christopher_Alexander">his name</a> to peek without leaving the page. <a href="/read/vitruvius">Vitruvius</a>, further back, said a related thing in Latin and is free as air — or fetch him from <a href="https://www.gutenberg.org/ebooks/20239">Gutenberg</a>. The <a href="https://en.wikipedia.org/wiki/The_Timeless_Way_of_Building">Timeless Way</a> is the feeling, not the catalog. A <a href="https://en.wikipedia.org/wiki/Courtyard">courtyard</a> is a room without a roof. Read both. The pattern is older than any of us.</p>
<p>When a place — or a page — is alive, you will not want to take a picture of it. You will want to stay. That is the whole test. Stay a little longer than is efficient. Mark what kept you.</p>`,
    ),
    c(
      "ls-6",
      "The next page",
      `<p>There is a superstition among people who love tools that the tool must be completed before the life can start. Finish the perfect notes system, then read. Finish the perfect house, then live. The superstition is how rooms stay empty and books stay downloaded.</p>
<p>The next page is a better religion. You turn it. You mark one sentence if one sentence asked. You speak thirty seconds if thirty seconds of feeling arrived. You go outside. The structure accumulates the way a good street does: by being used, repaired, and used again.</p>
<p>If Folio does its job, it will become furniture. The paperclip will be boring. The tags will be yours, not ours. The voice you hear on a reread will be a slightly younger you, confused or delighted in a garden in San Francisco or on a train you cannot name. That is the whole product: a way not to lose the heat.</p>
<p>Close the sidebar. Two taps if something here was true. Speak if speaking is faster. Turn the page.</p>`,
    ),
  ],
};
