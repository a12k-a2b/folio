import type { Book } from "../types";

const c = (id: string, title: string, body: string): Book["chapters"][number] => ({
  id,
  title,
  html: `<p class="chapter-kicker">On Architecture · ${title}</p><h2>${title}</h2>${body}`,
});

export const vitruvius: Book = {
  id: "vitruvius",
  title: "On Architecture",
  author: "Vitruvius",
  year: "c. 30 BCE",
  description:
    "Public domain (Morgan translation). The oldest surviving book on building: firmness, commodity, delight — and why the architect must also be a reader.",
  coverLabel: "V",
  source: "bundled",
  chapters: [
    c(
      "vt-1",
      "The education of the architect",
      `<p>The architect should be equipped with knowledge of many branches of study and varied kinds of learning, for it is by his judgement that all work done by the other arts is put to test. This knowledge is the child of practice and theory. Practice is the continuous and regular exercise of employment where manual work is done with any necessary material according to the design of a drawing. Theory, on the other hand, is the ability to demonstrate and explain the productions of dexterity on the principles of proportion.</p>
<p>It follows, therefore, that architects who have aimed at acquiring manual skill without scholarship have never been able to reach a position of authority to correspond to their pains, while those who relied only upon theories and scholarship were obviously hunting the shadow, not the substance. But those who have a thorough knowledge of both, like men armed at all points, have the sooner attained their object and carried authority with them.</p>
<p>Let him be educated, skilful with the pencil, instructed in geometry, know much history, have followed the philosophers with attention, understand music, have some knowledge of medicine, know the opinions of the jurists, and be acquainted with astronomy and the theory of the heavens.</p>
<p>The reasons for all this are as follows. An architect ought to be an educated man so as to leave a more lasting remembrance in his treatises. Secondly, he must have a knowledge of drawing so that he can readily make sketches to show the appearance of the work which he proposes. Geometry, also, is of much assistance in architecture, and in particular it teaches us the use of the rule and compasses, by which especially we acquire readiness in making plans for buildings in their grounds, and rightly apply the square, the level, and the plummet.</p>
<p>As for philosophy, it makes an architect high-minded and not self-assuming, but rather renders him courteous, just, and honest without avariciousness. This is very important, for no work can be rightly done without honesty and incorruptibility. Let him not be grasping, nor have his mind preoccupied with the receiving of bribes, but let him with dignity keep up his position by cherishing a good reputation. These are among the precepts that philosophy gives.</p>
<p>Music, also, the architect ought to understand so that he may have knowledge of the canonical and mathematical theory, and besides be able to tune ballistae, catapultae, and scorpiones to the proper key. For to the right and left in the beams are the holes in the frames through which the strings of twisted sinew are stretched by means of windlasses and bars, and unless these strings are equally stretched, they will not give the missiles an equal and true direct flight.</p>
<blockquote>Architecture depends on Order, Arrangement, Eurythmy, Symmetry, Propriety, and Economy.</blockquote>
<p>Order is the balanced adjustment of the details of the work separately, and as to the whole, the arrangement of the proportion with a view to a symmetrical result. Arrangement includes the putting of things in their proper places and the elegance of effect which is due to adjustments appropriate to the character of the work. Eurythmy is beauty and fitness in the adjustments of the members. This is found when the members of a work are of a height suited to their breadth, of a breadth suited to their length, and, in a word, when they all correspond symmetrically.</p>`,
    ),
    c(
      "vt-2",
      "Firmness, commodity, delight",
      `<p>All buildings must be executed in such a way as to take account of durability, convenience, and beauty. Durability will be assured when foundations are carried down to the solid ground and materials wisely and liberally selected; convenience, when the arrangement of the apartments is faultless and presents no hindrance to use, and when each class of building is assigned to its suitable and appropriate exposure; and beauty, when the appearance of the work is pleasing and in good taste, and when its members are in due proportion according to correct principles of symmetry.</p>
<p>There are three departments of architecture: the art of building, the making of timepieces, and the construction of machinery. Building is, in its turn, divided into two parts, of which the first is the construction of fortified towns and of works for general use in public places, and the second is the putting up of buildings for private citizens.</p>
<p>The sites of cities should be chosen with care, in a healthy district, high enough to be free from fogs and frosts, with an aspect neither hot nor cold but temperate. Marshes are to be avoided. For when the morning breezes blow toward the town at sunrise, if they bring with them mists from marshes and, mingled with the mist, the poisonous breath of the creatures of the marshes to be wafted into the bodies of the inhabitants, they will make the site unhealthy.</p>
<p>After insuring on these principles the healthfulness of the future city, and selecting a neighbourhood that can supply plenty of food to maintain the community, with good roads or else convenient rivers or seaports affording easy transportation to the city, the next thing to do is to lay the foundations for the towers and walls.</p>
<p>The architect’s care is not only the wall. It is the life that will be lived against the wall. Exposure, the path of the sun, the smell of a marsh — these are not engineering footnotes. They are the difference between a house you can think in and a house you flee. Two thousand years later we still build the marsh and call it open plan, and we still need someone in the room who has read, and who will say no.</p>
<p>If you are reading this on a folio in a garden, notice the exposure you chose. That choice is already architecture. Mark the sentence that named it.</p>`,
    ),
  ],
};
