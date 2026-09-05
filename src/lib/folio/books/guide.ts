import type { Book } from "../types";

export const guide: Book = {
  id: "folio-guide",
  title: "A short guide to Folio",
  author: "Folio",
  year: "2026",
  description:
    "How to mark, speak, tag, and turn pages on the Daylight — one sitting, then go read a real book.",
  coverLabel: "·",
  source: "bundled",
  chapters: [
    {
      id: "g-1",
      title: "Hands",
      html: `<p class="chapter-kicker">Folio · Hands</p><h2>Hands</h2>
<p>This is a reader. It is trying to be a better Kindle for a paper computer, and a quieter Apple Books. The chrome hides. The book does not.</p>
<p>Turn a page by tapping the right third of the leaf, or swiping from the right. Tap the left third to go back. Tap the middle if you want the bar — title, bookmark, paperclip. Tap the middle again to put the bar away. The page should feel like paper being lifted, not a slide in a deck.</p>
<p>Marks are the Matter habit, because long-press handles are where reading goes to die.</p>
<p>Two taps highlight a word. Three taps take the sentence. Four taps take the paragraph. Press and drag when you want a custom span. Lift to keep it.</p>
<p>No menu first. No color picker. Daylight has no color; we would not insult the page with a highlighter rainbow even if it did.</p>
<p>Tap an existing mark to open it. That is where the voice lives — yours, or a friend’s. Hold the microphone in the lower-right corner (where your thumb already is on a folio) and speak. Lift to stop. The audio is kept, not just the words. Later you can hear whether you were excited, or sad, or confused. The transcript will not tell you that.</p>
<p>This is how a book club works here. You and a friend read the same book. You leave voices on sentences. You answer. Little back and forths, in the margin, with the feeling still in them.</p>
<p>Turn a page with the corners: left thumb back, right thumb forward. The top bar hides. Tap the middle of the page if you want the title and the paperclip. Tap again to put them away.</p>
<p>Hold a link. A sheet slides in from the right. Read it. Lift to go back. Drag left if you mean to keep it. That is Peek — you never open a tab.</p>
<p>Bookmark the page from the ribbon between your thumbs, once the page number is showing. One tap. It is a dog-ear, not a form.</p>`,
    },
    {
      id: "g-2",
      title: "Voice, tags, paperclip",
      html: `<p class="chapter-kicker">Folio · Voice</p><h2>Voice, tags, paperclip</h2>
<p>Typing a note while the feeling is still in the body is a translation tax. Hold the microphone to talk; lift to stop. That is push-to-talk. If you prefer, tap once to start and tap once to end. Both are the same button.</p>
<p>Living Structure arrives with a circle already in it — Alexander Circle, with Theo. He left you voices. Answer him. If a real friend should join, give them the invite code from the shelf. Sign in so the voices travel from this folio to the phone.</p>
<p>Tags are names, not colors. A person. A place. A book someone recommended. A question you were not ready to answer.</p>
<p>The paperclip opens a wide leaf: contents, the circle, the marks in this book, your tags, bookmarks, settings. It takes most of the page on purpose.</p>
<p>Gloss is a teacher’s margin, off until you want it. A single tap on a word then opens a two-sentence note. Link-preview is on: hold a citation, don’t leave the sentence.</p>
<p>Search the public stacks — Project Gutenberg — from the library, or upload an EPUB or an HTML leaf. Folio paginates both with the same engine.</p>
<p>When you are done with this guide, open <em>Living Structure</em>. Tap the first voice. Then put the paperclip away.</p>`,
    },
  ],
};
