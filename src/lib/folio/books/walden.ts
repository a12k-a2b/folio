import type { Book } from "../types";

const c = (id: string, title: string, body: string): Book["chapters"][number] => ({
  id,
  title,
  html: `<p class="chapter-kicker">Walden · ${title}</p><h2>${title}</h2>${body}`,
});

export const walden: Book = {
  id: "walden",
  title: "Walden",
  author: "Henry David Thoreau",
  year: "1854",
  description:
    "Public domain. Selected chapters from the pond: economy of life, and the morning that is never done.",
  coverLabel: "W",
  source: "bundled",
  chapters: [
    c(
      "wa-1",
      "Where I lived, and what I lived for",
      `<p>At a certain season of our life we are accustomed to consider every spot as the possible site of a house. I have thus surveyed the country on every side within a dozen miles of where I live. In imagination I have bought all the farms in succession, for all were to be bought, and I knew their price. I walked over each farmer's premises, tasted his wild apples, discoursed on husbandry with him, took his farm at his price, at any price, mortgaging it to him in my mind; even put a higher price on it — took everything but a deed of it — took his word for his deed, for I dearly love to talk — cultivated it, and him too to some extent, I trust, and withdrew when I had enjoyed it long enough, leaving him to carry it on.</p>
<p>I have frequently seen a poet withdraw, having enjoyed the most valuable part of a farm, while the crusty farmer supposed that he had got a few wild apples only. Why, the owner does not know it for many years when a poet has put his farm in rhyme, the most admirable kind of invisible fence, has fairly impounded it, milked it, skimmed it, and got all the cream, and left the farmer only the skimmed milk.</p>
<p>The real attractions of the Hollowell farm, to me, were: its complete retirement, being, about two miles from the village, half a mile from the nearest neighbor, and separated from the highway by a broad field; its bounding on the river, which the owner said protected it by its fogs from frosts in the spring, though that was nothing to me; the gray color and ruinous state of the house and barn, and the dilapidated fences, which put such an interval between me and the last occupant; the hollow and lichen-covered apple trees, gnawed by rabbits, showing what kind of neighbors I should have; but above all, the recollection I had of it from my earliest voyages up the river, when the house was concealed behind a dense grove of red maples, through which I heard the house-dog bark.</p>
<p>I went to the woods because I wished to live deliberately, to front only the essential facts of life, and see if I could not learn what it had to teach, and not, when I came to die, discover that I had not lived. I did not wish to live what was not life, living is so dear; nor did I wish to practise resignation, unless it was quite necessary. I wanted to live deep and suck out all the marrow of life, to live so sturdily and Spartan-like as to put to rout all that was not life, to cut a broad swath and shave close, to drive life into a corner, and reduce it to its lowest terms, and, if it proved to be mean, why then to get the whole and genuine meanness of it, and publish its meanness to the world; or if it were sublime, to know it by experience, and be able to give a true account of it in my next excursion.</p>
<blockquote>Simplicity, simplicity, simplicity! I say, let your affairs be as two or three, and not a hundred or a thousand.</blockquote>
<p>Still we live meanly, like ants; though the fable tells us that we were long ago changed into men; like pygmies we fight with cranes; it is error upon error, and clout upon clout, and our best virtue has for its occasion a superfluous and evitable wretchedness. Our life is frittered away by detail. An honest man has hardly need to count more than his ten fingers, or in extreme cases he may add his ten toes, and lump the rest. Keep your accounts on your thumb-nail.</p>
<p>If we respected only what is inevitable and has a right to be, music and poetry would resound along the streets. When we are unhurried and wise, we perceive that only great and worthy things have any permanent and absolute existence, that petty fears and petty pleasures are but the shadow of the reality.</p>`,
    ),
    c(
      "wa-2",
      "Solitude",
      `<p>This is a delicious evening, when the whole body is one sense, and imbibes delight through every pore. I go and come with a strange liberty in Nature, a part of herself. As I walk along the stony shore of the pond in my shirt-sleeves, though it is cool as well as cloudy and windy, and I see nothing special to attract me, all the elements are unusually congenial to me. The bullfrogs trump to usher in the night, and the note of the whip-poor-will is borne on the rippling wind from over the water. Sympathy with the fluttering alder and poplar leaves almost takes away my breath; yet, like the lake, my serenity is rippled but not ruffled.</p>
<p>I find it wholesome to be alone the greater part of the time. To be in company, even with the best, is soon wearisome and dissipating. I love to be alone. I never found the companion that was so companionable as solitude. We are for the most part more lonely when we go abroad among men than when we stay in our chambers. A man thinking or working is always alone, let him be where he will. Solitude is not measured by the miles of space that intervene between a man and his fellows. The really diligent student in one of the crowded hives of Cambridge College is as solitary as a dervish in the desert.</p>
<p>The farmer can work alone in the field or the woods all day, hoeing or chopping, and not feel lonesome, because he is employed; but when he comes home at night he cannot sit down in a room alone, at the mercy of his thoughts, but must be where he can “see the folks,” and recreate, and, as he thinks, remunerate himself for his day's solitude; and hence he wonders how the student can sit alone in the house all night and most of the day without ennui and “the blues”; but he does not realize that the student, though in the house, is still at work in his field, and chopping in his woods, as the farmer in his, and in turn seeks the same recreation and society that the latter does, though it may be a more condensed form of it.</p>
<p>Society is commonly too cheap. We meet at very short intervals, not having had time to acquire any new value for each other. We meet at meals three times a day, and give each other a new taste of that old musty cheese that we are. We have had to agree on a certain set of rules, called etiquette and politeness, to make this frequent meeting tolerable and that we need not come to open war. We meet at the post-office, and at the sociable, and about the fireside every night; we live thick and are in each other's way, and stumble over one another, and I think that we thus lose some respect for one another.</p>
<p>I have a great deal of company in my house; especially in the morning, when nobody calls. Let me suggest a few comparisons, that some one may convey an idea of my situation. I am no more lonely than the loon in the pond that laughs so loud, or than Walden Pond itself. What company has that lonely lake, I pray? And yet it has not the blue devils, but the blue angels in it, in the azure tint of its waters.</p>
<blockquote>I have never felt lonesome, or in the least oppressed by a sense of solitude, but once, and that was a few weeks after I came to the woods, when, for an hour, I doubted if the near neighborhood of man was not essential to a serene and healthy life.</blockquote>
<p>In the midst of a gentle rain I was suddenly sensible of such sweet and beneficent society in Nature, in the very pattering of the drops, and in every sound and sight around my house, an infinite and unaccountable friendliness all at once like an atmosphere sustaining me, as made the fancied advantages of human neighborhood insignificant, and I have never thought of them since.</p>`,
    ),
  ],
};
