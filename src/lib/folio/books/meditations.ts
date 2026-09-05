import type { Book } from "../types";

const c = (id: string, title: string, body: string): Book["chapters"][number] => ({
  id,
  title,
  html: `<p class="chapter-kicker">Meditations · ${title}</p><h2>${title}</h2>${body}`,
});

export const meditations: Book = {
  id: "meditations",
  title: "Meditations",
  author: "Marcus Aurelius",
  year: "c. 170",
  description:
    "Selections from the George Long translation (public domain). A Roman emperor writing to himself, not to an audience — the original private notebook.",
  coverLabel: "M",
  source: "bundled",
  chapters: [
    c(
      "ma-1",
      "Book I · Debts",
      `<p>From my grandfather Verus I learned good morals and the government of my temper.</p>
<p>From the reputation and remembrance of my father, modesty and a manly character.</p>
<p>From my mother, piety and beneficence, and abstinence, not only from evil deeds, but even from evil thoughts; and further, simplicity in my way of living, far removed from the habits of the rich.</p>
<p>From my great-grandfather, not to have frequented public schools, and to have had good teachers at home, and to know that on such things a man should spend liberally.</p>
<p>From my tutor, not to side with the Green or the Blue at the races, nor with the Parmularius or the Scutarius at the gladiators; from him too I learned endurance of labour, and to want little, and to work with my own hands, and not to meddle with other people's affairs, and not to be ready to listen to slander.</p>
<p>From Diognetus, not to waste time on trifles, and not to give credit to what was said by miracle-workers and jugglers about incantations and the driving away of daemons and such things; and not to breed quails for fighting, nor to give myself up passionately to such things; and to endure freedom of speech; and to become intimate with philosophy.</p>
<p>From Rusticus I received the impression that my character required improvement and discipline; and from him I learned not to be led astray to sophistic emulation, nor to writing on speculative matters, nor to delivering little hortatory orations, nor to showing myself off as a man who practises much discipline, or does benevolent acts in order to make a display.</p>
<p>From Apollonius I learned freedom of will and undeviating steadiness of purpose; and to look to nothing else, not even for a moment, except to reason; and to be, at all times, the same, in sharp pains, on the occasion of the loss of a child, and in long illness.</p>
<p>From Sextus, a benevolent disposition, and the example of a family governed in a fatherly manner, and the idea of living conformably to nature; and gravity without affectation, and to look carefully after the interests of friends, and to tolerate ignorant persons, and those who form opinions without consideration.</p>
<p>From Alexander the grammarian, to refrain from fault-finding, and not in a reproachful way to chide those who uttered any barbarous or solecistic or strange-sounding expression; but dexterously to introduce the very expression which ought to have been used.</p>
<p>From my brother Severus, to love my kin, and to love truth, and to love justice; and through him I learned to know Thrasea, Helvidius, Cato, Dion, Brutus; and from him I received the idea of a polity in which there is the same law for all, a polity administered with regard to equal rights and equal freedom of speech, and the idea of a kingly government which respects most of all the freedom of the governed.</p>`,
    ),
    c(
      "ma-2",
      "Book II · On the river",
      `<p>Begin the morning by saying to thyself, I shall meet with the busy-body, the ungrateful, arrogant, deceitful, envious, unsocial. All these things happen to them by reason of their ignorance of what is good and evil. But I who have seen the nature of the good that it is beautiful, and of the bad that it is ugly, and the nature of him who does wrong, that it is akin to me, not only of the same blood or seed, but that it participates in the same intelligence and the same portion of the divinity, I can neither be injured by any of them, for no one can fix on me what is ugly, nor can I be angry with my kinsman, nor hate him.</p>
<p>Whatever this is that I am, it is a little flesh and breath, and the ruling part. Throw away thy books; no longer distract thyself: it is not allowed; but as if thou wast now dying, despise the flesh; it is blood and bones and a network, a contexture of nerves, veins, and arteries. See the breath also, what kind of a thing it is, air, and not always the same, but every moment sent out and drawn in. The third then is the ruling part: consider: thou art an old man; no longer let this be a slave, no longer be pulled by the strings like a puppet to unsocial movements, no longer either be dissatisfied with thy present lot, or shrink from the future.</p>
<p>All that is from the gods is full of Providence. That which is from fortune is not separated from nature or without an interweaving and involution with the things which are ordered by Providence. From thence all things flow; and there is besides necessity, and that which is for the advantage of the whole universe, of which thou art a part.</p>
<p>Remember how long thou hast been putting off these things, and how often thou hast received an opportunity from the gods, and yet dost not use it. Thou must now at last perceive of what universe thou art a part, and of what administrator of the universe thy existence is an efflux, and that a limit of time is fixed for thee, which if thou dost not use for clearing away the clouds from thy mind, it will go and thou wilt go, and it will never return.</p>
<p>Every moment think steadily as a Roman and a man to do what thou hast in hand with perfect and simple dignity, and feeling of affection, and freedom, and justice; and to give thyself relief from all other thoughts. And thou wilt give thyself relief, if thou doest every act of thy life as if it were the last, laying aside all carelessness and passionate aversion from the commands of reason, and all hypocrisy, and self-love, and discontent with the portion which has been given to thee.</p>
<p>How quickly all things disappear, and the bodies themselves, in the universe, but what of this? The memory of them in time. What is the character of all sensible things, and particularly those which attract with the bait of pleasure or terrify by pain, or are noised abroad by vapoury fame; how worthless, and contemptible, and sordid, and perishable, and dead they are — all this it is the part of the intellectual faculty to observe.</p>
<blockquote>The universe is transformation: life is opinion.</blockquote>
<p>Thou art a little soul bearing about a corpse, as Epictetus used to say.</p>
<p>It is no evil for things to undergo change, and no good for things to subsist in consequence of change. Time is like a river made up of the events which happen, and a violent stream; for as soon as a thing has been seen, it is carried away, and another comes in its place, and this will be carried away too.</p>`,
    ),
    c(
      "ma-3",
      "Book IV · The inner citadel",
      `<p>That which rules within, when it is according to nature, is so affected with respect to the events which happen, that it always easily adapts itself to that which is and is presented to it. For it requires no definite material, but it moves towards its purpose, under certain conditions however; and it makes a material for itself out of that which opposes it, as fire lays hold of what falls into it, and it would use it for its own purpose.</p>
<p>Do not waste the remainder of thy life in thoughts about others, when thou dost not refer thy thoughts to some object of common utility. For thou losest the opportunity of doing something else when thou hast such thoughts as these: What is such a person doing, and why, and what is he saying, and what is he thinking of, and what is he contriving, and whatever else of the kind makes us wander away from the observation of our own ruling power.</p>
<p>The property of the rational soul is to see itself, to analyse itself, to make itself such as it wishes to be, to itself reap the fruit it bears. The rational soul also loves itself. And it arrives at its own end, the end which is marked out by the constitution of things.</p>
<p>Men seek retreats for themselves, houses in the country, sea-shores, and mountains; and thou too art wont to desire such things very much. But this is altogether a mark of the most common sort of men, for it is in thy power whenever thou shalt choose to retire into thyself. For nowhere either with more quiet or more freedom from trouble does a man retire than into his own soul, particularly when he has within him such thoughts that by looking into them he is immediately in perfect tranquillity; and I affirm that tranquillity is nothing else than the good ordering of the mind.</p>
<blockquote>Constantly then give to thyself this retreat, and renew thyself.</blockquote>
<p>If thou art pained by any external thing, it is not this thing that disturbs thee, but thy own judgement about it. And it is in thy power to wipe out this judgement now. But if anything in thy own disposition gives thee pain, who hinders thee from correcting thy opinion?</p>
<p>Be like the promontory against which the waves continually break, but it stands firm and tames the fury of the water around it.</p>
<p>Unhappy am I because this has happened to me? Not so, but happy am I, though this has happened to me, because I continue free from pain, neither crushed by the present nor fearing the future.</p>
<p>Remember that everything is only an opinion, and that it is in thy power to think as thou wilt. Then why art thou disturbed? What is new in this? What is there in it which cannot be wiped out?</p>
<p>Soon, very soon, thou wilt be ashes, or a skeleton, and either a name or not even a name; but name is sound and echo. And the things which are much valued in life are empty and rotten and trifling, and like little dogs biting one another, and little children quarrelling, laughing, and then straightway weeping.</p>
<p>Examine men's governing principles, even those of the wise, what kind of things they are, and what they avoid, and what they pursue.</p>
<p>Everything is in a manner the seed of that which will be. But thou art thinking only of seeds which are cast into the earth or into a womb: but this is a very vulgar notion.</p>`,
    ),
  ],
};
