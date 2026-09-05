import type { Book } from "../types";

const c = (id: string, title: string, body: string): Book["chapters"][number] => ({
  id,
  title,
  html: `<p class="chapter-kicker">The Book of Tea · ${title}</p><h2>${title}</h2>${body}`,
});

export const bookOfTea: Book = {
  id: "book-of-tea",
  title: "The Book of Tea",
  author: "Okakura Kakuzō",
  year: "1906",
  description:
    "Public domain. A short, exact book about tea, and therefore about rooms, manners, and the religion of the imperfect.",
  coverLabel: "茶",
  source: "bundled",
  chapters: [
    c(
      "tea-1",
      "The cup of humanity",
      `<p>Tea began as a medicine and grew into a beverage. In China, in the eighth century, it entered the realm of poetry as one of the polite amusements. The fifteenth century saw Japan ennoble it into a religion of aestheticism — Teaism. Teaism is a cult founded on the adoration of the beautiful among the sordid facts of everyday existence. It inculcates purity and harmony, the mystery of mutual charity, the romanticism of the social order. It is essentially a worship of the Imperfect, as it is a tender attempt to accomplish something possible in this impossible thing we know as life.</p>
<p>The Philosophy of Tea is not mere aestheticism in the ordinary acceptance of the term, for it expresses conjointly with ethics and religion our whole point of view about man and nature. It is hygiene, for it enforces cleanliness; it is economics, for it shows comfort in simplicity rather than in the complex and costly; it is moral geometry, inasmuch as it defines our sense of proportion to the universe. It represents the true spirit of Eastern democracy by making all its votaries aristocrats in taste.</p>
<p>The long isolation of Japan from the rest of the world, so conducive to introspection, has been highly favourable to the development of Teaism. Our home and habits, costume and cuisine, porcelain, lacquer, painting — our very literature — all have been subject to its influence. No student of Japanese culture could ever ignore its presence. It has permeated the elegance of noble boudoirs, and entered the abode of the humble. Our peasants have learned to arrange flowers, our meanest labourer to offer his salutation to the rocks and waters. In our common parlance we speak of the man “with no tea” in him, when he is insusceptible to the serio-comic interests of the personal drama. On the other hand, the insipid person, unable to rise above the common-places of existence, is branded as one “with too much tea” in him.</p>
<p>The outsider may indeed wonder at this seeming much ado about nothing. What a tempest in a tea-cup! he will say. But when we consider how small after all the cup of human enjoyment is, how soon overflowed with tears, how easily drained to the dregs in our quenchless thirst for infinity, we shall not blame ourselves for making so much of the tea-cup. Mankind has enjoyed but a very limited tea-service. The afternoon glow is brightening the plain, let us not lose ourselves in the future or the past. Let us dream of evanescence, and linger in the beautiful foolishness of things.</p>
<p>The book is public; the afternoon is not. Read this the way it was meant to be read: one cup, one sitting, no hurry. If a sentence is a room you want to keep, mark it. If a name is a person, tag the person. Kakuzō is writing across an ocean, defending a culture from being treated as bric-a-brac. That, too, is a pattern.</p>`,
    ),
    c(
      "tea-2",
      "The schools of tea",
      `<p>Tea is a work of art and needs a master hand to bring out its noblest qualities. We have good and bad tea, as we have good and bad paintings — generally the latter. There is no single recipe for making the perfect tea, as there are no rules for producing a Titian or a Sesson. Each preparation of the leaves has its individuality, its special affinity with water and heat, its own method of telling a story. The truly beautiful must always be in it. How much do we not suffer from the lack of this fine appreciation in life!</p>
<p>The tea-ideal, however, reached its culmination in the tea-ceremony of Japan in the fifteenth century. Our Tea-masters were more than artists — they were the heralds of art. They were the real aristocrats of taste, who made possible that atmosphere in which the great painters, lacquerers, and metal-workers of later ages could flourish. The tea-room is not a place for display. It is a place in which to compose oneself. The very poverty of the room is its wealth.</p>
<p>In the liquid amber within the ivory-porcelain, the initiated may touch the sweet reticence of Confucius, the piquancy of Laotse, and the ethereal aroma of Sakyamuni himself.</p>
<p>Those who cannot feel the littleness of great things in themselves are apt to overlook the greatness of little things in others. The average Westerner, in his sleek complacency, will see in the tea ceremony but another instance of the thousand and one oddities which constitute the quaintness and childishness of the East to him. He was wont to regard Japan as barbarous while she indulged in the gentle arts of peace: he calls her civilised since she began to commit wholesale slaughter on Manchurian battlefields.</p>
<blockquote>Fain would we remain barbarians, if our claim to civilisation were to be based on the gruesome glory of war.</blockquote>
<p>The tea-room is a house of the incompletion. A bouquet, a picture, a kettle — never the whole museum at once. This is the opposite of the dashboard. One center, a few supporting planets, and a door you have to bow to enter. The bow is not humility as performance. It is a way of making the body agree that it has arrived.</p>`,
    ),
    c(
      "tea-3",
      "The tea-room",
      `<p>To European architects, trained in the school of stone and brick, the idea of a room being built of wood and bamboo, and paper windows, and a floor of mats, seems scarcely more than a joke. Yet in this perishable building, so apparently fragile, is embodied a principle as sound as that of the marble palaces of the West — the principle of making a dwelling a part of nature, not a fortress against it.</p>
<p>The tea-room does not pretend to be other than a mere cottage — a straw hut, as we call it. The original tea-room was an adaptation of the little thatched hut of the hermit, a place of refuge from the world. It is an Abode of Fancy, inasmuch as it is an ephemeral structure built to house a poetic impulse. It is an Abode of Vacancy, inasmuch as it is devoid of ornament except for what may be placed in it to satisfy some aesthetic need of the moment. It is an Abode of the Unsymmetrical, inasmuch as it is consecrated to the worship of the Imperfect, purposely leaving something unfinished for the play of the imagination to complete.</p>
<p>The size of the orthodox tea-room is four mats and a half, or about ten feet square. The materials used in its construction are intended to appear simple and even rustic. The interior is dim, for the light is admitted only through paper windows. The guests approach by a garden path, the <em>roji</em>, designed to break connection with the outside world and to produce a fresh sensation conducive to the full enjoyment of aestheticism in the tea-room itself. One who has trodden this garden path cannot fail to remember how his spirit, as he walked in the twilight of evergreens over the regular irregularities of the stepping stones, became oblivious of the dust of the world.</p>
<p>A Japanese room may look bare to our eyes, but it is only the realisation of the need for space in which to think. We must remember that the simplicity of the tea-room is not the simplicity of poverty, but the simplicity of purpose. Nothing is there that is not required, and everything that is required is there in its most becoming form.</p>
<p>Read that last sentence again on a device that is trying to be paper. The empty margin is not a missing feature. It is the <em>roji</em>. You walk it every time you turn a page without a toolbar appearing. If the toolbar appears, you have left the garden.</p>`,
    ),
  ],
};
