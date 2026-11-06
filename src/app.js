import { createMediaRecovery } from "./media-recovery.js";
import { createPlaylist } from "./playlist.js";
import { nftCatalog } from "./nft-catalog.js";
import { sceneLabels, closeReads } from "./narrative.js";
import { portraits } from "./portraits.js";
import {
  moments,
  people,
  sources,
  relationships,
  chapter,
  identities,
} from "./data.js";

const main = document.querySelector("#main");
const sheet = document.querySelector("#sheet");
const listening = document.querySelector("#listening");
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const collectionPlayer = createPlaylist({
  records: nftCatalog,
  imageURL: nftImage,
  escape: esc,
  beforePlay: () => stopListening(),
});
const momentById = (id) => moments.find((m) => m.id === id);
const personById = (id) => people.find((p) => p.id === id);
let currentBase = "",
  lastFocus = null,
  mediaTimer = null,
  directoryController = null,
  lastRenderedHref = "",
  keyboardInput = false;
const params = () => new URLSearchParams(location.hash.split("?")[1] || "");
const base = () => location.hash.split("?")[0] || "#/";
const detailHref = (kind, id) => {
  const p = params();
  p.delete("person");
  p.delete("source");
  p.set(kind, id);
  return `${base()}?${p}`;
};
const personLink = (id) => {
  const p = personById(id);
  return `<a class="person-chip" href="${detailHref("person", id)}">${portrait(id) ? photo(portrait(id), "initial") : ""}<span>${esc(p.name)}</span><span aria-hidden="true">↗</span></a>`;
};
const sourceButton = (m) =>
  `<div class="small-label">Inspect the record</div>${m.sources.map((id) => `<a class="source-link" href="${detailHref("source", id)}"><span class="source-dot"></span> ${esc(sources[id].title)} ↗</a>`).join("")}`;
const nextLink = (id, text, cls = "") =>
  `<a class="${cls}" href="#/moment/${id}">${text}</a>`;

const visuals = {
  ujo: {
    file: "imogen-song-map.png",
    alt: "Imogen Heap’s song map: Tiny Human surrounded by recording, artwork, video and composition credits",
    credit:
      "Imogen Heap · Tiny Human song map · talk published March 2018, reflecting on the earlier experiment",
    url: "https://medium.com/humanizing-the-singularity/smart-contracts-for-the-music-industry-3e641f87cc7",
  },
  tk: {
    file: "tk-never-forget.gif",
    alt: "Never Forget — original Eternal Garden token artwork",
    credit: "TK · Never Forget · still from original NFT artwork",
    url: "https://etherscan.io/token/0xa76cb9106781fA1eDa36B6D369d398b383278283?a=486",
  },
  tape: {
    file: "tape-launch.png",
    alt: "Historical screenshot of RAC’s BOY cassette release on Zora",
    credit:
      "May 2020 • historical Zora storefront, reproduced by co-founder Jacob Horne in Bankless; not a live offer",
    url: "https://banklesscom.beehiiv.com/p/how-to-buy-tape-on-zora",
  },
  genesis: {
    file: "genesis-party.png",
    alt: "Songcamp's Genesis virtual gathering at Ghost Extension in May 2021",
    credit:
      "May 2021 • Genesis gathering in Cryptovoxels, published by Songcamp",
    url: "https://paragraph.com/@songcamp/a-place-for-music-and-the-new-internet-to-crash-into-each-other",
  },
  chat: {
    file: "genesis-chat.png",
    alt: "An early Songcamp Discord conversation published in its history",
    credit:
      "April 2021 • early Songcamp Discord, reproduced in the community history",
    url: "https://paragraph.com/@songcamp/a-place-for-music-and-the-new-internet-to-crash-into-each-other",
  },
  daniel: {
    file: "daniel-allan.jpg",
    alt: "Daniel Allan's public author photograph",
    credit: "Daniel Allan • artist's author photograph, date unspecified",
    url: "https://paragraph.com/@danielallan/the-overstimulated-journey",
  },
  soundYear: {
    file: "sound-year.png",
    alt: "Sound's first anniversary visual identity",
    credit: "Sound • first-anniversary artwork, 2022",
    url: "https://paragraph.com/@soundxyz/sound-s-1-year-anniversary",
  },
  sof: {
    file: "sound-of-fractures-press.jpg",
    alt: "Sound of Fractures beneath an open sky",
    credit: "Sound of Fractures • Let Go press photograph, 2023",
    url: "https://dmy.co/new-music/sound-of-fractures-pushes-boundaries-with-multi-media-single-let-go",
  },
  camp: {
    file: "cc0lab-08.png",
    alt: "Orange and pink organic forms from Songcamp’s CC0lab",
    credit: "CC0lab artwork • Songcamp’s later open-source experiment",
    url: "https://github.com/songcamp/cc0lab",
  },
  chaos: {
    file: "cc0lab-01.png",
    alt: "Interwoven luminous shapes from the CC0lab project",
    credit: "CC0lab artwork • a branch of CHAOS, not the CHAOS cover",
    url: "https://github.com/songcamp/cc0lab",
  },
  iman: {
    file: "iman-europe-press.png",
    alt: "Iman Europe smiling against a green backdrop",
    credit: "Iman Europe • official press portrait, undated",
    url: "https://www.imaneurope.com/presskit",
  },
  latasha: {
    file: "latasha-press.jpg",
    alt: "LATASHÁ leaping in front of a red and blue wall",
    credit: "LATASHÁ • press portrait, 2016; not an event photograph",
    url: "https://callmelatasha.com/presskit/2016/7/15/i1tiwf87yzl2yf4buk62mpsjq7h5jq",
  },
  rae: {
    file: "rae-isla-live.jpg",
    alt: "Rae Isla performing with an acoustic guitar",
    credit: "Rae Isla • photograph by Fede Petro; performance date unconfirmed",
    url: "https://www.raeisla.com/epk",
  },
};
const sceneVisual = (id) =>
  id === "tiny-human"
    ? visuals.ujo
    : id === "eternal-garden"
      ? visuals.tk
      : id === "future-surf"
        ? portraits["cam-murdoch"]
        : id === "black-dave-glass"
          ? portraits["black-dave-mk2"]
          : momentById(id)?.noVisual
            ? {
                documentTitle: momentById(id).short,
                credit: "Source-led research chapter",
                url: momentById(id).artifactUrl,
              }
            : visuals[
                {
                  "music-nft": "chaos",
                  "early-records": "genesis",
                  "meeting-places": "genesis",
                  genesis: "genesis",
                  overstimulated: "daniel",
                  "nftnyc-2021": "daniel",
                  "sound-genesis": "soundYear",
                  soulection: "soundYear",
                  "open-doors": "soundYear",
                  afterglow: "rae",
                  tape: "tape",
                  remix: "sof",
                  walls: "camp",
                  chaos: "chaos",
                  sound: "iman",
                  zoratopia: "latasha",
                  network: "rae",
                  scenes: "sof",
                  rae: "rae",
                  cc0lab: "camp",
                }[id] || "chaos"
              ];
const portrait = (id) => portraits[id];
const photo = (v, cls = "", eager = false) => {
  if (v.documentTitle)
    return `<span class="archive-document ${cls}" aria-label="Research chapter"><span>From the archive</span><strong>${esc(v.documentTitle)}</strong></span>`;
  if (v.personId && !v.file)
    return `<img class="${cls}" src="/people/${v.personId}-160.webp" srcset="/people/${v.personId}-160.webp 160w, /people/${v.personId}-640.webp 640w" sizes="${cls === "initial" ? "28px" : cls === "index-avatar" ? "90px" : "(max-width: 650px) 90vw, 600px"}" alt="${esc(v.alt)}" loading="${eager ? "eager" : "lazy"}" decoding="async" width="160" height="160">`;
  return `<img class="${cls}" src="/media/${v.file.replace(/\.[^.]+$/, "")}-960.webp" srcset="/media/${v.file.replace(/\.[^.]+$/, "")}-480.webp 480w, /media/${v.file.replace(/\.[^.]+$/, "")}-960.webp 960w, /media/${v.file.replace(/\.[^.]+$/, "")}-1500.webp 1500w" sizes="${cls === "scene-image" ? "(max-width: 650px) 1500px, 100vw" : cls === "index-avatar" ? "65px" : "(max-width: 650px) 90vw, 45vw"}" alt="${esc(v.alt)}" loading="${eager ? "eager" : "lazy"}" decoding="async">`;
};
const imageCredit = (v) =>
  `<a class="image-credit" href="${v.url}" target="_blank" rel="noopener noreferrer">${esc(v.credit)} ↗</a>${v.licenseURL ? `<a class="image-license" href="${esc(v.licenseURL)}" target="_blank" rel="noopener noreferrer">${esc(v.license)} license ↗</a>` : ""}`;
function home() {
  return `<div class="film"><section class="opening film-opening">
    <div class="film-hero-image">${photo(visuals.rae, "film-hero-photo", true)}</div>
    <div class="film-hero-copy"><p class="film-kicker">Music Nerd presents / The Music NFT era</p><h1>A scene,<br>in the making.</h1><p class="film-deck">A song could be a record.<br>A record could be a meeting place.<br>And the people could build what came next.</p><button class="film-listen" data-play-collection aria-label="Play the collection"><span aria-hidden="true">▶</span> Listen while you explore</button></div>
    <div class="film-hero-bottom"><span>Scroll into the story ↓</span><details class="opening-credits"><summary>The photograph</summary>${imageCredit(visuals.rae)}<p>A performance portrait, not evidence of a particular NFT-era event.</p></details></div>
  </section><section class="film-prelude"><span class="film-kicker">A selected history / earlier experiments to afterlives</span><p>The music was everywhere.<br>The people making it wanted <em>more say.</em></p><div><p>A play count could tell an artist how far a song travelled. It could not, by itself, create a lasting relationship with the people listening. Artists began testing another possibility: release work on their own terms, recognize its supporters and invite them into what happened next.</p><dl class="nft-words"><div><dt>Non-fungible</dt><dd>Not interchangeable like-for-like. This particular item has its own identity and history—like a particular signed record.</dd></div><div><dt>Token</dt><dd>Something that represents something else: an object, an idea, even a feeling—as in a token of appreciation. Here, a digital record associated with a song or other work.</dd></div></dl><p>The music can still be copied and heard. The blockchain records the token’s ownership, not exclusive possession of the sound. The story is what people made possible around it.</p></div></section>${scrollStory()}${storyExit()}<details class="film-timeline"><summary>Explore the wider chronology</summary>${eraTimeline()}</details></div>`;
}
// The homepage tells the story in normal document flow. Details are optional.
function scrollStory() {
  const sequences = [
    {
      id: "collect",
      date: "Begin with a song",
      visual: "camp",
      source: "nftBasics",
      moment: "music-nft",
      beats: [
        [
          "The music could stay open.",
          "You could listen to a song without owning its NFT. The collectible was a distinct digital token associated with the recording: an edition someone could hold or pass on. The blockchain kept track of that token. The song itself often lived elsewhere. Listening and collecting became two different ways to participate.",
        ],
        [
          "What did someone actually own?",
          "Owning the token did not automatically mean owning the copyright. Each release set its own terms. For some artists, the immediate possibility was simpler: a listener could support a specific piece of work, and that support could be visible. To find those listeners—and other musicians—artists began finding new places to gather.",
        ],
      ],
    },
    {
      id: "release",
      date: "2021 / finding another way",
      visual: "daniel",
      source: "allan",
      moment: "overstimulated",
      beats: [
        [
          "A record needed to happen.",
          "As those communities took shape, artists were testing how early a listener could become involved. Daniel Allan’s Overstimulated campaign began in September 2021; the EP arrived the following January. People supported a record before they could hear the finished thing. Allan connected his releases with a project treasury and promised it a portion of his artist share of master royalties. The arrangement was specific to this project. Its broader challenge was clear: could support arrive at the moment an artist needed to make the work, rather than only after it was complete?",
        ],
        [
          "A release was also an introduction.",
          "Allan also recalls sharing a Gansevoort stage during NFT.NYC with VÉRITÉ, LATASHÁ and Matthew Chaim. The story was already moving beyond a release page. There were rooms to enter, performances to hear, and other artists to meet. But first: what was this new kind of record people were collecting?",
        ],
      ],
    },
    {
      id: "rooms",
      date: "2021 / finding each other",
      visual: "genesis",
      source: "genesis",
      moment: "meeting-places",
      beats: [
        [
          "The room was a link.",
          "Songcamp began in the disruption of the pandemic, when canceled shows and online isolation had changed how musicians could meet. Its first camp started in April 2021: nine musicians, two visual artists and two operators making songs and a release together. Twitter led people into Discord; calls became a working space. The virtual gathering pictured here belongs to that early world. A collectible might offer a new way to release music, but the camp was asking an earlier question: who could you make it with?",
        ],
        [
          "A handle became a collaborator.",
          "For Three Oscillators, joining that world meant getting on a weekly call at 2:30 a.m. in Mumbai. The time matters. Behind an online handle was a musician fitting unfamiliar people into the hours of an ordinary life. Later, in CHAOS, he would make Walls with Boy Untitled and Lackhoney. Their account moves from calls and demos to decisions about vocals, words and production. The tools helped people find each other. Familiarity, attention and musical judgment turned that encounter into a song.",
        ],
      ],
    },
    {
      id: "editions",
      date: "Late 2021–2022 / different kinds of records",
      visual: "soundYear",
      source: "soundYear",
      moment: "sound-genesis",
      beats: [
        [
          "One song. More than one way to collect.",
          "Sound’s first drop, OSHI’s CHILDHOOD, arrived in November 2021. Where Catalog foregrounded one-of-one records, Sound offered editions that several listeners could collect. The difference shaped the invitation: one song could have a group of identifiable supporters around it. Glass brought another kind of work into view, treating video as the release itself. Musicians, filmmakers and performers were testing different forms of participation. The question was no longer simply whether a song could be collected. It was what collecting could make possible around the work.",
        ],
        [
          "The format shaped the experiment.",
          "Soulection+ Radio: UNTITLED 001 brought several artists into one listening experience. Sound introduced Song Splits alongside the project, using 0xSplits to route proceeds to multiple recipients. Here the experiment reached into the arrangement between collaborators. A shared release needed a way to share what came back. That practical problem leads into one of the era’s most ambitious projects: a band large enough to include musicians, visual artists, developers and organizers, all building the release together.",
        ],
      ],
    },
    {
      id: "band",
      date: "2022 / making together",
      visual: "camp",
      source: "walls",
      moment: "walls",
      beats: [
        [
          "Strangers. A deadline. A shared song.",
          "Songcamp’s CHAOS launch account described 77 contributors, including 45 musicians. Rotating trios wrote in acts; other participants built artwork, stories, software and radio around the songs. The release arrived in packs, with a digital festival on June 3, 2022. Even the form of the band was an experiment. Rather than gather behind one frontperson, contributors built a structure that could keep producing new combinations. To understand what that scale meant musically, follow one trio into one recording.",
        ],
        [
          "Meet the trio.",
          "Lackhoney sent unused vocal demos. Boy Untitled heard his own relationship in Walls, then reshaped its words and topline. Three Oscillators built the production around the vocal. In their oral history, the artists describe files moving between time zones and work taking shape around demo calls. CHAOS had arranged the encounter; the song came from what each person heard in the others’ contributions. This is the collective at its most intimate: an unfinished idea becoming something none of the three brought into the room alone.",
        ],
      ],
    },
    {
      id: "gather",
      date: "2022 / meeting in person",
      visual: "latasha",
      source: "zoratopia",
      moment: "zoratopia",
      beats: [
        [
          "The people behind the handles took the stage.",
          "LATASHÁ helped make places where the online scene could meet in person. Zoratopia’s Austin program billed Black Dave in March 2022; June reporting from New York described three days of programming and performances by LATASHÁ and Iman Europe. A release page could introduce the work. A gathering let people hear it together. Other rooms produced new experiments of their own: Glass filmed Black Dave performing for wavWRLD collectors, and Dave presented the resulting video NFT with a plan to share proceeds with existing supporters. The relationship around one performance became material for the next release.",
        ],
        [
          "And the connections kept moving.",
          "In May 2023, a Sound of Fractures remix release brought together AmbieNFT, Three Oscillators, Kabuki and Green Ring. Sound of Fractures’ release notes describe wanting artist communities to meet through music. We can now recognize one name from the earlier collaboration. The credit gives us a concrete route between projects without assuming that one platform or event caused the next release.",
        ],
      ],
    },
    {
      id: "remain",
      date: "Afterward / an unfinished history",
      visual: "rae",
      source: "soundEnd",
      moment: "afterglow",
      beats: [
        [
          "A token can outlast a website.",
          "The promise of a record that could move beyond one storefront eventually met a harder test: the storefront closing. Sound announced its website would go offline in January 2026 as its team focused on Vault. Catalog’s closing account described successive attempts to keep its model working. A token, a recording and the place people discover it have different lives. The token’s history may survive while a listening experience disappears. Independence from a platform still leaves work to do: finding the music, keeping it accessible and remembering why it mattered.",
        ],
        [
          "What did people carry forward?",
          "For Pete, the lasting change was in where he located value: the people, their work and their ability to make things together. He connects the experience to becoming a technology entrepreneur. With new software tools, he sees less reason to wait for a platform to build what his community needs. That is his account, rather than a conclusion every participant would share. It brings this history back to its opening question. Artists were asking for more say over the future of their work. Some learned to approach the tools around it as things they could make, too.",
        ],
      ],
    },
  ];
  // Six movements. The primer is part of the artist's stakes, not another gate.
  const primer = sequences.shift();
  sequences[0].beats.push(...primer.beats);
  sequences[0].beatSources = ["allan", "allan", "nftBasics", "nftBasics"];
  const rooms = sequences.find((s) => s.id === "rooms");
  rooms.beats.push([
    "The room needed people who kept showing up.",
    "By February 2023, Future Surf Radio was making space for the work between releases. Its weekly schedule moved through rollout discussions, music reviews and technical conversations. Cam Murdoch appeared across those sessions with different collaborators; Charm Taylor and Diamond Doll used a recurring gathering to build For The People DAO in public. The newsletter pointed listeners toward new music too. This was the less spectacular work of a scene: hearing an unfinished idea, sharing something useful and returning the next week. A release could attract attention. A routine helped people sustain it.",
  ]);
  rooms.beatSources = ["genesis", "walls", "futureSurf"];
  const band = sequences.find((s) => s.id === "band");
  band.beats.push([
    "A credit leads somewhere else.",
    "In May 2023, Three Oscillators appeared on Sound of Fractures’ NOKMLY remix release with AmbieNFT, Kabuki and Green Ring. Jamie Reddington, the artist behind Sound of Fractures, wanted different artist communities to meet through music. The shared credit takes us from a temporary band to another musician’s song and another collaborative task. Listen across the two projects and the network becomes audible. It is made of people carrying their practice into new settings, rather than a fixed roster belonging to one platform.",
  ]);
  band.beatSources = ["chaosLaunch", "walls", "remixes"];
  const gather = sequences.find((s) => s.id === "gather");
  gather.beats.pop();
  const remain = sequences.find((s) => s.id === "remain");
  remain.beats[1] = [
    "Preservation is another kind of work.",
    "Network Archives gathered creative practices into a publication in 2024. In July 2026, SoundCloud announced an acquisition of Nina that included preserving its editorial archive and genre map. These are different acts of keeping a culture available: one gathers people’s work and accounts; another carries an existing archive into a new home. This documentary performs a smaller version of that task. Following a recording back to its credits and its original media can recover something a closed homepage no longer shows. The history continues through what people choose to maintain, reuse and build next.",
  ];
  remain.beats.push([
    "What did people carry forward?",
    "For Pete, the lasting change was in where he located value: the people, their work and their ability to make things together. He connects the experience to becoming a technology entrepreneur. With new software tools, he sees less reason to wait for a platform to build what his community needs. That is his account, rather than a conclusion every participant would share. It brings this history back to its opening question. Artists were asking for more say over the future of their work. Some learned to approach the tools around it as things they could make, too.",
  ]);
  remain.beatSources = ["soundEnd", "nina2026", null];
  const opening = sequences[0];
  const danielBeats = opening.beats.slice(0, 2);
  opening.date = "2015–March 2021 / before the scene had a name";
  opening.visual = "tape";
  opening.beats = [
    [
      "Who gets to decide what happens next?",
      "Benjamin James knew what it meant to have someone else decide a record’s future. Writing as musicben in February 2022, he looked back on being signed and dropped by a major label in 2014. His interest in music NFTs came from that experience: a search for another way to reach supporters and keep making work. The question running through this history is larger than a new release format. Who gets to decide what happens around a song: how it reaches people, how its makers are paid, and what its listeners can become part of? Musicians answered with records, experiments and communities they helped build themselves.",
    ],
    [
      "A song should carry its people with it.",
      "Years before the collecting boom, Imogen Heap was looking at the people a song’s title leaves out. Through Mycelia, she imagined a recording carrying its credits, permissions and connections with it. Tiny Human gave that idea a concrete test. In 2015, Heap and Ujo used Ethereum to connect licensing choices with automatic payments to contributors. The prototype made part of the machinery behind a release visible and programmable. Ujo closed it in 2016 because maintaining it took resources from its next platform. That tension would return: an artist could imagine a different system, but somebody still had to build it, explain it and keep it working.",
    ],
    [
      "Before the boom, a cassette.",
      "In May 2020, RAC and Zora put an old-fashioned object at the center of a new release: 100 BOY cassettes. A digital token could be redeemed for a tape. Zora co-founder Jacob Horne traced the idea through a fashion experiment, conversations online and a group call. The musician and the builders were designing the release together. These were fungible tokens, rather than unique NFT editions. But the experiment opened a question that would animate the next wave: what else could artists change if they could shape the tools around their work?",
    ],
    [
      "A record shop for the internet.",
      "Jeremy Stern and Mike McKain approached that question as musicians and record diggers. Before Catalog, they built Loft Radio, where listeners could tip artists. Catalog, launched in March 2021, gave direct support a different form: a one-of-one digital record. The music could stay available to hear while someone collected its edition. It was a proposition about attention as much as technology. A song could be treated as a particular work worth seeking out and supporting, with a visible history around it.",
    ],
    [
      "The song was still there for everyone.",
      "Listen to EPROM’s How U Make Me Feel. You do not need to own its token to hear it. “Non-fungible” means individually identifiable, not interchangeable like-for-like. “Token” means a representation of something else: in this case, a digital record associated with a work. A blockchain records who holds that token and when it changes hands. Copying the song does not copy its ownership history. The recording itself often lives elsewhere, and copyright does not automatically transfer with the token. Catalog’s founders used this EPROM release to explain another possibility: a record discovered through their site could also be bid on through Zora. The work did not have to belong to one storefront. What mattered next was whether people would gather around it.",
    ],
  ];
  opening.beatSources = [
    "musicben2022",
    "heapMycelia",
    "tape",
    "catalogOrigins",
    "catalogInterview",
  ];
  opening.moment = "catalog";
  const editions = sequences.find((s) => s.id === "editions");
  editions.beats.unshift(danielBeats[0]);
  editions.beatSources = ["allan", "soundYear", "soundYear"];
  editions.date = "September 2021–2022 / artists try different paths";
  // A thematic middle needs explicit time shifts; branches carry the extra depth.
  opening.beats[0] = [
    "They were making more than records.",
    "In 2021 and 2022, musicians began turning releases into experiments in working together. A song could help fund the next recording. A music video could be collected as an artwork. An online songwriting camp could become CHAOS: 77 contributors building songs, images and software for a release they shared. These were different answers to a familiar problem: how do you keep making music, and bring the people who care about it closer? Music NFTs gave these artists a new set of tools. What followed depended on the people using them. To understand how that scene formed, we begin before the boom—with an attempt to change what happens behind a song.",
  ];
  opening.beatSources[0] = "chaosLaunch";
  opening.beats[4] = [
    "Hear the song. Follow the record.",
    "Listen to EPROM’s How U Make Me Feel. You do not need to own its NFT to hear it. The token connects this particular edition to a history of ownership. Copying the audio does not copy that history, and buying the token does not automatically buy the copyright. Catalog’s founders pointed to another possibility: this record could be found through Catalog and bid on through Zora. Different front doors could lead to the same edition. But a record still needed people to find it.",
  ];

  rooms.date = "2021–2023 / making a place to return";
  rooms.beats[2] = [
    "A scene needed people who kept showing up.",
    "Those rooms mattered beyond a launch. By February 2023, Future Surf Radio’s weekly schedule moved between rollout discussions, music reviews and technical conversations. Cam Murdoch appeared with different collaborators; Charm Taylor and Diamond Doll used a recurring session to build For The People DAO in public. The newsletter sent listeners toward new releases too. A scene was taking shape through repetition: bring an idea, hear someone else’s work, learn something and return. Alongside that everyday work, artists were testing how a release could invite people in.",
  ];
  editions.beats[0][1] =
    "Rewind to September 2021, when Daniel Allan asked listeners to help a record happen before it was finished. " +
    editions.beats[0][1]
      .split(/(?<=[.!?])\s+/)
      .slice(1)
      .join(" ");
  gather.beats[0][1] =
    "LATASHÁ helped make places where the online scene could meet in person. Zoratopia’s Austin program billed Black Dave in March 2022. In June, reporting from New York described three days of programming, with performances by LATASHÁ and Iman Europe. The work people had encountered through profiles and release pages could now be heard together. These gatherings opened another part of the story: what happened when the people behind the handles shared a room—and what they made after they left it.";
  remain.beats[1] = [
    "Someone still has to keep the door open.",
    "The Park’s own archive gathers releases scattered across Catalog, Sound and Zora. A listener can follow a song to its credits, a playlist or an original edition without remembering which storefront first hosted it. That is practical work, and it changes what remains available to discover. This documentary tries a smaller version of the same task: follow the recording back to the people and the media it names. A record of ownership can survive. Keeping the music findable still takes care.",
  ];
  remain.beatSources[1] = "parkWorks";
  remain.beats[2][1] =
    "For Pete, the lasting change was where he located value: in people, their work and their ability to make things together. He connects that experience to becoming a technology entrepreneur. With new software tools, he sees less reason to wait for a platform to build what his community needs. His perspective brings us back to the question we began with. Who gets to decide what happens around a song? This chapter follows artists trying to take a larger part in that answer—by making records, making room for one another, and sometimes making the tools themselves.";
  opening.beats[4][1] +=
    " LATASHÁ and filmmaker Jah were asking a related question about music videos: could the complete visual work be collected, rather than treated only as promotion for a song?";
  gather.beats[0] = [
    "Making a room meant deciding who belonged.",
    "LATASHÁ’s reasons for organizing went beyond getting people offline. In Minted, she recalls a performance being stopped and feeling excluded from NFT events in ways she recognized from the music industry. A new technology had not automatically made a welcoming space. She began teaching artists how to mint and find their way around the platforms. Zoratopia turned that work into gatherings: Austin’s March 2022 program billed Black Dave; New York reporting that June described performances by LATASHÁ and Iman Europe. The scene needed people willing to shape the room, not only people willing to enter it.",
  ];
  gather.beatSources = ["minted"];
  remain.beats[0][1] =
    "The promise of more control met a difficult question: which parts could artists actually control? Resale payments could be specified without every marketplace honoring them. Later, the storefront itself could disappear: Sound announced its website would go offline in January 2026, while Catalog’s closing account traced attempts to sustain its model. A token, its media and the place people find it have different lives. In Minted, LATASHÁ returns to the practical task of funding another video. The story carried on through what people could make—and what they could keep available.";
  const deeperBranches = {
    "release-4": [["latasha-videos", "LATASHÁ and Jah: the video as a work"]],
    "remain-0": [
      ["royalties", "What resale royalties could—and could not—promise"],
    ],
    "rooms-2": [["learning-in-public", "Artists teaching artists"]],
    "gather-0": [
      ["latasha-videos", "Why LATASHÁ began building spaces"],
      ["black-dave-glass", "A performance became a video experiment"],
      ["campfire-miami", "Inside CAMPFIRE’s Miami recording"],
    ],
    "band-2": [
      ["lnrz-satellites", "A sample pack became Sara Phillips’ next release"],
    ],
    "remain-1": [["the-park", "Inside The Park’s continuing archive"]],
  };
  const chapterNames = [
    "How it began",
    "Finding each other",
    "Reinventing the release",
    "Making CHAOS",
    "Building a place to belong",
    "What remains",
  ];
  const frames = {
    release: ["walls", "ujo", "tape", "catalogRecord", "catalogRecord"],
    rooms: ["genesis", "chat", "genesis"],
    editions: ["daniel", "soundYear", "soundYear"],
    band: ["walls", "trio", "sof"],
    gather: ["latasha"],
    remain: ["rae", "park", "rae"],
  };
  const frame = (key, index) => {
    if (key === "prehistory")
      return `<div class="film-frame frame-prehistory" data-frame="${index}" aria-hidden="true"><span>2015</span><div>A song.<br>Its credits.<br>Its terms.</div><small>Tiny Human / the licensing & payments experiment</small></div>`;
    if (key === "catalogRecord")
      return `<div class="film-frame frame-catalogRecord" data-frame="${index}"><img class="scroll-art-image" src="/media/catalog-eprom-960.webp" alt="EPROM — How U Make Me Feel, original Catalog token artwork" loading="lazy"><span class="film-frame-credit">EPROM / How U Make Me Feel / original token artwork</span></div>`;
    if (key === "park")
      return `<div class="film-frame frame-artwork" data-frame="${index}"><img class="scroll-art-image" src="${nftImage(nftCatalog.find((r) => r.id === "park-sound-do-it").imageURI)}" alt="Do It — The Park and Being There, release artwork" loading="lazy"><span class="film-frame-credit">The Park & Being There / Do It / original release artwork</span></div>`;
    if (key === "walls")
      return `<div class="film-frame frame-artwork" data-frame="${index}"><img class="scroll-art-image" src="/media/chaos-walls-960.webp" alt="Walls — original CHAOS token artwork" loading="lazy"><span class="film-frame-credit">Walls / original CHAOS NFT artwork</span></div>`;
    if (key === "trio")
      return `<div class="film-frame frame-people" data-frame="${index}">${["three-oscillators", "boy-untitled", "lackhoney"].map((id) => `<a href="${detailHref("person", id)}">${photo(portrait(id))}<span>${esc(personById(id).name)}</span></a>`).join("")}</div>`;
    return `<div class="film-frame frame-${key}" data-frame="${index}">${photo(visuals[key], "scroll-art-image")}<span class="film-frame-credit">${imageCredit(visuals[key])}</span></div>`;
  };
  return `<article class="scroll-story film-story" aria-label="The story, as you scroll"><nav class="documentary-rail" aria-label="Documentary chapters"><span class="documentary-location">How it began</span><details class="chapter-menu"><summary>Chapters</summary><div>${sequences.map((section, i) => `<button data-story-jump="${section.id}" aria-label="Jump to ${chapterNames[i]}"><span>${String(i + 1).padStart(2, "0")}</span>${chapterNames[i]}</button>`).join("")}</div><a href="#/about">About this chapter</a></details></nav>${sequences
    .map(
      (section, n) =>
        `<section class="scroll-sequence film-scene film-${section.id}" id="story-${section.id}" data-active-beat="0" aria-labelledby="story-title-${section.id}"><figure class="scroll-art film-visual">${frames[section.id].map(frame).join("")}<div class="film-veil"></div></figure><div class="scroll-passages">${section.beats
          .map(([title, copy], i) => {
            const source = section.beatSources
              ? section.beatSources[i]
              : section.source;
            const primerBeat = section.id === "release" && i === 4;
            const extra =
              {
                "release-0": [
                  ["allan", "Funding a record: Daniel Allan"],
                  ["minted", "Collecting a video: LATASHÁ’s account"],
                  [
                    "musicben2022",
                    "One artist’s reason: Benjamin James on leaving the label system",
                  ],
                ],
                "release-1": [
                  ["ujoHistory", "What the prototype did—and why it closed"],
                ],
                "release-3": [["catalogInterview", "Catalog in April 2021"]],
                "rooms-2": [
                  ["erinMint", "Mint Songs"],
                  ["soundYear", "Sound’s editions"],
                ],
                "editions-1": [
                  ["glassHome", "Glass and video"],
                  ["catalogInterview", "Catalog’s model"],
                ],
                "remain-0": [["catalogFin", "Catalog’s closing account"]],
                "gather-0": [
                  ["zoraJune", "New York performances"],
                  ["blackDaveGlass", "Black Dave’s filmed experiment"],
                ],
                "band-0": [["architecture", "Inside CHAOS"]],
              }[`${section.id}-${i}`] || [];
            let paragraphs = storyParagraphs(copy);
            if (section.id === "release" && i === 3)
              paragraphs = paragraphs
                .replace(
                  "Jeremy Stern",
                  `<a class="person-mention" aria-haspopup="dialog" href="${detailHref("person", "jeremy-stern")}">Jeremy Stern</a>`,
                )
                .replace(
                  "Mike McKain",
                  `<a class="person-mention" aria-haspopup="dialog" href="${detailHref("person", "mike-mckain")}">Mike McKain</a>`,
                )
                .replace(
                  "Loft Radio",
                  `<a href="${detailHref("person", "loft-radio")}">Loft Radio</a>`,
                );
            return `<div class="scroll-beat film-beat beat-${i}" data-beat="${i}" ${primerBeat ? 'id="story-collect"' : ""}><div class="film-copy">${section.id === "release" && i === 1 ? `<figure class="heap-mobile-art">${photo(visuals.ujo)}<figcaption>${imageCredit(visuals.ujo)}</figcaption></figure>` : ""}<p class="scroll-date">${section.id === "remain" && i === 2 ? "Pete’s perspective / shared for this documentary" : section.id === "release" ? ["2021–2022 / a movement comes into view", "2015 / Imogen Heap, Mycelia & Ujo", "May 2020 / RAC & Zora", "March 2021 / Catalog", "2021 / listening & collecting"][i] : section.id === "rooms" && i === 2 ? "February 2023 / the work between releases" : section.id === "band" && i === 2 ? "May 2023 / another collaboration" : esc(section.date)}</p><h2 ${i === 0 ? `id="story-title-${section.id}"` : ""}>${esc(title)}</h2>${paragraphs}${section.id === "editions" && i === 2 ? formatComparison() : ""}${section.id === "band" && i === 1 ? `<div class="people-strip">${["three-oscillators", "boy-untitled", "lackhoney"].map(personLink).join("")}</div>` : ""}${section.id === "band" && i === 2 ? '<button class="button secondary" data-listen="remix">▶ Hear the connection</button>' : ""}<details class="beat-evidence"><summary>Notes & connections</summary><div class="scroll-footnotes">${section.id === "release" && i === 0 ? `<span>Participant perspective: <a href="${detailHref("person", "benjamin-james")}">Benjamin James</a></span>` : ""}${source ? `<a href="${detailHref("source", source)}">Source notes →</a>` : "<p>Pete’s personal reflection, supplied during development. Not presented as every participant’s experience.</p>"}${(deeperBranches[`${section.id}-${i}`] || []).map(([id, label]) => `<a href="#/moment/${id}">${esc(label)} →</a>`).join("")}${extra.map(([id, label]) => `<a href="${detailHref("source", id)}">${esc(label)} →</a>`).join("")}${section.id === "release" && i === 1 ? '<a href="#/moment/tiny-human">Inside the Tiny Human experiment ↗</a>' : ""}${primerBeat ? '<a href="#/moment/music-nft">Explore this thread ↗</a><a href="#/moment/catalog">Inside Catalog ↗</a>' : i === section.beats.length - 1 ? `<a href="#/moment/${section.moment}">Explore this thread ↗</a>` : ""}</div></details></div></div>`;
          })
          .join(
            "",
          )}</div></section>${recordInterlude(section.id)}${deeperThreads(section.id)}`,
    )
    .join("")}</article>`;
}

function deeperThreads(chapter) {
  const branches = {
    rooms: ["future-surf"],
    editions: ["eternal-garden", "moonshot"],
    band: ["heart-project"],
    gather: ["black-dave-glass", "chill-pill"],
    remain: ["coop-records"],
  }[chapter];
  if (!branches) return "";
  return `<aside class="deeper-threads" aria-label="Go deeper"><span>There is more to this story</span>${branches
    .map((id) => {
      const m = momentById(id);
      return `<a href="#/moment/${id}"><strong>${esc(m.short)}</strong><span>${esc(m.deck)}</span><span aria-hidden="true">↗</span></a>`;
    })
    .join("")}</aside>`;
}

function recordInterlude(chapter) {
  const stories = {
    release: {
      title: "Put the record on.",
      text: "EPROM’s How U Make Me Feel appeared in Catalog’s April 2021 founder interview. Hear the original token’s media, then follow its edition back to the record.",
      ids: ["catalog-eprom-1715"],
    },
    editions: {
      title: "A sample pack became another artist’s song.",
      text: "LNRZ’s release notes describe inviting people to work with the SATELLITES sample pack. Sara Phillips sent back a track that became a spotlight release. Here is the result—and a recording from the collection that started the invitation.",
      ids: ["record-00396a23", "record-7de1ee42"],
    },
    band: {
      title: "This is what the room made.",
      text: "Hear Walls, the song made by Three Oscillators, Boy Untitled and Lackhoney. Then explore the wider CHAOS collection: different groups, different sounds, one shared experiment. There are 43 selected songs to explore here, each a different route into the larger band.",
      ids: ["record-chaos-walls"],
    },
    gather: {
      title: "The gatherings left something to hear.",
      text: "One NFT documents Iman Europe performing at Zoratopia FETE in Miami on December 3, 2022. A separate CAMPFIRE release traces Miami Freestyle to an Art Basel artist camp, crediting AbJo’s production and Pete Rango’s mixing and mastering. One carries the energy of a performance; the other carries a group’s studio work. Both let us hear what a gathering produced.",
      ids: ["record-1e31c103", "record-69c77ef0", "record-2f2ac4ec"],
    },
  };
  const story = stories[chapter];
  if (!story) return "";
  return `<section class="record-interlude interlude-${chapter}"><div class="interlude-copy"><p class="small-label">Listen inside the story</p><h2>${esc(story.title)}</h2><p>${esc(story.text)}</p><p class="interlude-credit">Account and credits attributed to the original NFT release notes. Open a player to inspect the token and its media address.</p></div>${chapter === "band" ? '<div class="actions"><a class="button primary" href="#/records?collection=CHAOS">Hear 43 CHAOS songs</a><a class="button secondary" href="#/collection/record-chaos-walls">Browse CHAOS editions</a><a href="#/moment/chaos">How 77 contributors made it together ↗</a></div>' : ""}<div class="interlude-records">${story.ids
    .map((id) => nftCatalog.find((r) => r.id === id))
    .filter(Boolean)
    .map((record) => nftCard(record))
    .join("")}</div></section>`;
}

function storyParagraphs(copy) {
  const sentences = copy.split(/(?<=[.!?])\s+/);
  const middle = Math.ceil(sentences.length / 2);
  return [
    sentences.slice(0, middle).join(" "),
    sentences.slice(middle).join(" "),
  ]
    .filter(Boolean)
    .map((text) => `<p>${esc(text)}</p>`)
    .join("");
}
function formatComparison() {
  return `<details class="format-comparison"><summary>Compare the release formats</summary><dl><div><dt>A collectible edition</dt><dd>A token associated with a release; its terms determine what accompanies it. <a href="${detailHref("source", "nftBasics")}">Ownership distinctions ↗</a></dd></div><div><dt>A project crowdfund</dt><dd>Support before the finished work. Allan’s project had a specific treasury and royalty arrangement. <a href="${detailHref("source", "allan")}">Overstimulated ↗</a></dd></div><div><dt>Shared payments</dt><dd>A way to route proceeds among recipients. It does not establish who composed or performed a work. <a href="${detailHref("source", "soundProtocol")}">Sound Protocol ↗</a></dd></div></dl></details>`;
}
function storyExit() {
  return `<section class="story-exit"><a href="#/moment/the-park">Keep following the work: The Park’s cross-platform archive ↗</a><p class="small-label">Stay a little longer</p><h2>Pick up another thread.</h2><div><a href="#/explore?view=people"><strong>Follow a person ↗</strong><span>Credits, collaborations and the records behind them.</span></a><a href="#/explore"><strong>Trace the moments ↗</strong><span>Explore the chapter in a different order.</span></a><div><a href="#/records"><strong>Explore the original NFTs ↗</strong></a><button data-listen="remix">▶ NOKMLY remixes</button><button data-listen="scenes">▶ SCENES</button><span>Official players. Sound starts only when you choose.</span></div></div></section>`;
}
let storyObserver;
let filmMotionCleanup;
function observeStory() {
  storyObserver?.disconnect();
  filmMotionCleanup?.();
  const beats = main.querySelectorAll(".scroll-beat");
  if (!beats.length) return;
  const scenes = [...main.querySelectorAll(".film-scene")];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let queued = 0;
  const paint = () => {
    queued = 0;
    for (const scene of scenes) {
      const bounds = scene.getBoundingClientRect();
      if (bounds.top < innerHeight && bounds.bottom > 0) {
        // One playhead selects the passage at the reading position. Unlike
        // observer-entry ordering, this is deterministic in both directions.
        const passages = [...scene.querySelectorAll(".scroll-beat")];
        const active = passages.find((beat) => {
          const rect = beat.getBoundingClientRect();
          return (
            rect.top <= innerHeight * 0.55 && rect.bottom > innerHeight * 0.55
          );
        });
        if (active) {
          scene.dataset.activeBeat = active.dataset.beat;
          const id = scene.id.replace("story-", "");
          const button = main.querySelector(`[data-story-jump="${id}"]`);
          const label = main.querySelector(".documentary-location");
          if (button && label)
            label.textContent = button
              .getAttribute("aria-label")
              .replace("Jump to ", "");
          main
            .querySelectorAll("[data-story-jump]")
            .forEach((control) =>
              control.setAttribute(
                "aria-current",
                control.dataset.storyJump === id ? "step" : "false",
              ),
            );
        }
        const progress = Math.max(
          0,
          Math.min(1, -bounds.top / Math.max(1, bounds.height - innerHeight)),
        );
        scene.style.setProperty(
          "--drift",
          reduced.matches ? "0px" : `${(progress - 0.5) * 32}px`,
        );
      }
    }
  };
  const queue = () => {
    if (!queued) queued = requestAnimationFrame(paint);
  };
  addEventListener("scroll", queue, { passive: true });
  addEventListener("resize", queue);
  reduced.addEventListener("change", queue);
  paint();
  filmMotionCleanup = () => {
    removeEventListener("scroll", queue);
    removeEventListener("resize", queue);
    reduced.removeEventListener("change", queue);
    cancelAnimationFrame(queued);
  };
}

function eraTimeline() {
  const eras = [
    {
      year: "2020–21",
      label: "New ways to release",
      ids: ["tape", "early-records", "genesis", "overstimulated"],
    },
    {
      year: "2021–22",
      label: "A community takes shape",
      ids: ["meeting-places", "nftnyc-2021", "sound-genesis", "soulection"],
    },
    {
      year: "2022",
      label: "Making things together",
      ids: ["chaos", "walls", "sound", "zoratopia", "cc0lab"],
    },
    {
      year: "2023–24",
      label: "What the connections made possible",
      ids: ["open-doors", "club-chaos", "remix", "dutch", "network"],
    },
    {
      year: "Afterward",
      label: "What stays, what changes",
      ids: ["common-pool", "scenes", "afterglow"],
    },
  ];
  return `<section class="era-map"><div class="era-map-heading"><h2>A few moments that changed the shape of things.</h2><p>Take the guided chapter, or step into a moment. These are selected turning points in one connected community—not the complete history of music NFTs.</p></div>${eras
    .map(
      (e) =>
        `<section class="era-row"><div class="era-year"><span>${e.year}</span><h3>${e.label}</h3></div><div class="era-moments">${e.ids
          .map((id) => {
            const m = momentById(id);
            return `<a href="#/moment/${id}">${photo(sceneVisual(id))}<small>${esc(m.date)}</small><strong>${esc(m.short)}</strong></a>`;
          })
          .join("")}</div></section>`,
    )
    .join("")}</section>`;
}
function primer() {
  const tabs = [
    [
      "music",
      "The music",
      "A recording you can hear",
      "Listening and collecting are different actions. In many projects, everyone could hear the song; collectors acquired editions associated with it.",
    ],
    [
      "token",
      "The token",
      "A distinct entry in a shared record",
      "NFT means non-fungible token. Non-fungible: not interchangeable like-for-like, because this particular item has its own identity and history. Token: a representation of something else, such as a recording, a membership or a contribution. “Minting” creates the token’s record. It does not make the associated music impossible to copy.",
    ],
    [
      "relationship",
      "The relationship",
      "What comes with the edition?",
      "It depends on the release. A token may mark support or connect to access, artwork or other terms. Copyright and revenue rights do not come automatically.",
    ],
  ];
  return `<section class="nft-primer" aria-labelledby="primer-heading"><div><p class="small-label">Three things to keep separate</p><h2 id="primer-heading">Same song.<br>Different layers.</h2><p>No wallet or crypto knowledge needed.</p></div><div class="primer-interaction"><div role="tablist" aria-label="Understand a music NFT">${tabs.map(([id, label], i) => `<button role="tab" id="tab-${id}" data-primer="${id}" aria-controls="primer-${id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${label}</button>`).join("")}</div>${tabs.map(([id, label, title, body], i) => `<div role="tabpanel" id="primer-${id}" aria-labelledby="tab-${id}" ${i ? "hidden" : ""}><h3>${title}</h3><p>${body}</p><a href="${detailHref("source", "nftBasics")}">Check the distinction ↗</a></div>`).join("")}</div></section>`;
}

function momentView(m) {
  const index = chapter.indexOf(m.id),
    previous = index > 0 ? chapter[index - 1] : null,
    next = index >= 0 ? chapter[index + 1] : null,
    v = m.id === "latasha-videos" ? visuals.latasha : sceneVisual(m.id);
  const platformScene = ["catalog", "glass", "the-park"].includes(m.id);
  const sceneArtwork =
    m.id === "catalog"
      ? `<img class="scene-image" src="${nftImage(nftCatalog.find((r) => r.id === "catalog-eprom-1715").imageURI)}" alt="EPROM — How U Make Me Feel, original token artwork">`
      : m.id === "the-park"
        ? `<img class="scene-image" src="${nftImage(nftCatalog.find((r) => r.id === "park-sound-do-it").imageURI)}" alt="The Park and Being There — Do It release artwork">`
        : m.id === "glass"
          ? `<div class="video-title-art" aria-hidden="true">Moving<br>images<span>▶</span></div>`
          : photo(v, "scene-image", true);
  return `<article class="story scene-${m.id}">
  <section class="scene-stage">${sceneArtwork}<div class="scene-shade"></div><div class="scene-top"><a href="#/">← Opening</a><span>${esc(m.date)} / ${esc(m.type)}</span><nav class="scene-step" aria-label="Move through the chapter">${previous ? `<a href="#/moment/${previous}" aria-label="Previous scene">←</a>` : ""}<span>${index >= 0 ? `${index + 1} / ${chapter.length}` : "A side path"}</span>${next ? `<a href="#/moment/${next}" aria-label="Next scene">→</a>` : ""}</nav></div><div class="scene-title"><h1>${esc(m.title)}</h1><p>${esc(m.deck)}</p><div class="actions">${m.album ? `<button class="button primary" data-listen="${m.id}">▶ ${esc(m.listenAction || "Listen to the release")}</button>` : `<a class="button primary" target="_blank" rel="noopener noreferrer" href="${m.artifactUrl}">${esc(m.artifact)} ↗</a>`}<a class="button glass" href="${detailHref("source", m.sources[0])}">Behind this moment</a></div></div>${
    platformScene
      ? `<span class="image-credit">${m.id === "catalog" ? "EPROM · original NFT artwork, not Catalog branding" : m.id === "the-park" ? "The Park & Being There · Do It, original release artwork" : "Editorial title card · Glass video history"}</span>`
      : imageCredit(v)
  }</section>
  <nav class="contact-sheet" aria-label="Chapter scenes">${chapter.map((id, i) => `<a href="#/moment/${id}" ${id === m.id ? 'aria-current="step"' : ""}>${photo(sceneVisual(id))}<span><small>${String(i + 1).padStart(2, "0")}</small>${esc(sceneLabels[id] || momentById(id).short)}</span></a>`).join("")}</nav>
  <div class="story-below">${
    m.recordIds?.length
      ? `<section class="branch-recordings" aria-label="Recordings in this chapter"><p class="small-label">Hear the work behind this story</p><div class="interlude-records">${m.recordIds
          .map((id) => nftCatalog.find((r) => r.id === id))
          .filter(Boolean)
          .map((r) => nftCard(r))
          .join("")}</div></section>`
      : ""
  }${
    m.id === "the-park"
      ? `<div class="interlude-records">${nftCatalog
          .filter((r) =>
            [
              "park-sound-do-it",
              "park-zora-becky-v2",
              "park-catalog-belle",
            ].includes(r.id),
          )
          .map((r) => nftCard(r))
          .join(
            "",
          )}</div><a class="button secondary" href="#/records?q=The%20Park">Explore The Park’s recordings</a>`
      : ""
  }${m.id === "music-nft" ? primer() : ""}${
    m.id === "walls" || m.id === "chaos"
      ? `<div class="moment-nft"><p class="small-label">Hear the work itself</p>${nftCatalog
          .filter((r) => r.id === "record-chaos-walls")
          .map((record) => nftCard(record))
          .join("")}</div>`
      : ""
  }${m.id === "chaos" ? `<div class="actions"><a class="button primary" href="#/records?collection=CHAOS">Hear 43 CHAOS songs</a><a class="button secondary" href="#/collection/record-chaos-walls">Browse CHAOS editions</a></div>` : ""}${
    m.id === "eternal-garden"
      ? `<div class="moment-nft"><h2>Hear the work, then hear the response.</h2><p>Never Forget and AL3C’s cover are separate NFTs. Their release notes provide a concrete connection beyond the world’s story.</p>${nftCatalog
          .filter((r) => ["record-a76cb910", "record-4850d617"].includes(r.id))
          .map((record) => nftCard(record))
          .join("")}</div>`
      : ""
  }${m.id === "catalog" ? `<div class="moment-nft">${nftCard(nftCatalog.find((r) => r.id === "catalog-eprom-1715"))}</div>` : ""}${m.id === "glass" ? `<p><a class="button secondary" href="#/records?media=video">Explore videos & audiovisual works</a></p>` : ""}${m.id === "meeting-places" ? `<figure class="document-artifact">${photo(visuals.chat)}<figcaption>${imageCredit(visuals.chat)}<p>A trace of the ordinary conversations around the music. This screenshot is an artifact, not a live chat.</p></figcaption></figure>` : ""}<section class="story-narrative"><div><p class="small-label">The connection</p>${m.body
    .split("\n\n")
    .map((paragraph) => `<p class="body-copy">${esc(paragraph)}</p>`)
    .join(
      "",
    )}${m.interpretation ? `<p class="curator-note">${esc(m.interpretation)}<small>Editorial interpretation</small></p>` : ""}</div>${m.people.length ? `<div class="credits"><h2>The people in this moment</h2><div class="people-strip">${m.people.map(personLink).join("")}</div></div>` : ""}</section>
  ${closeReads[m.id] ? `<section class="close-reading" aria-label="Inside this experiment"><p class="small-label">Inside the experiment / a closer reading</p>${closeReads[m.id].map((part) => `<section class="story-narrative"><div><h2>${esc(part.title)}</h2><p class="body-copy">${esc(part.text)}</p><a href="${detailHref("source", part.source)}">Read the account ↗</a></div></section>`).join("")}${m.id === "walls" ? '<a class="button secondary" href="#/moment/chaos">How the CHAOS experiment worked →</a>' : m.id === "chaos" ? '<a class="button secondary" href="#/moment/walls">Follow three musicians into Walls →</a>' : ""}</section>` : ""}
  <details class="record"><summary>Sources & context <span>＋</span></summary><div class="provenance">${sourceButton(m)}</div>${m.uncertainty ? `<h3>Where the record is incomplete</h3><p>${esc(m.uncertainty)}</p>` : ""}${correctionLink(m.short, "#/moment/" + m.id)}</details>
  <section class="connections"><h2>Follow another thread</h2><div>${m.related
    .map((id) => {
      const r = momentById(id);
      return `<a href="#/moment/${id}" class="connection">${photo(sceneVisual(id))}<span class="connection-copy"><small>${esc(r.date)}</small><strong>${esc(r.short)}</strong><span>Explore this moment ↗</span></span></a>`;
    })
    .join("")}</div></section>
  ${m.bridge ? `<p class="chapter-bridge">${esc(m.bridge)}</p>` : ""}<footer class="story-footer">${previous ? nextLink(previous, "← Previous stop", "quiet") : '<a class="quiet" href="#/">← Opening</a>'}${next ? nextLink(next, `<span>Next in the chapter</span><strong>${esc(momentById(next).short)} →</strong>`, "next-stop") : '<a class="next-stop" href="#/explore"><span>The chapter continues through you</span><strong>Find someone to hear next →</strong></a>'}</footer></div></article>`;
}

function nftImage(uri) {
  if (!uri || uri.startsWith("data:")) return "";
  if (uri.startsWith("ipfs://"))
    return "https://ipfs.filebase.io/ipfs/" + uri.slice(7);
  if (uri.startsWith("ar://")) return "https://arweave.net/" + uri.slice(5);
  return [
    "https://arpeggi-prod-public.s3.us-west-2.amazonaws.com/",
    "https://arweave.net/",
    "https://soundxyz.mypinata.cloud/ipfs/",
  ].some((prefix) => uri.startsWith(prefix))
    ? uri
    : "";
}
const chainName = (id) =>
  ({ 1: "Ethereum", 10: "Optimism", 8453: "Base", 7777777: "Zora" })[id] ||
  "Unknown chain";
const explorer = (id) =>
  ({
    1: "etherscan.io",
    10: "optimistic.etherscan.io",
    8453: "basescan.org",
    7777777: "explorer.zora.energy",
  })[id];
function nftCard(record, compact = false) {
  const cachedArtwork = [
    "record-69c77ef0",
    "record-not4me",
    "record-not4me-acoustic",
    "record-xcelencia-isla",
    "record-xcelencia-soltera",
  ];
  const image = cachedArtwork.includes(record.id)
    ? `/media/${record.id}-960.webp`
    : record.id === "record-a76cb910"
      ? "/media/tk-never-forget-960.webp"
      : record.id === "record-chaos-walls"
        ? "/media/chaos-walls-960.webp"
        : record.id === "catalog-eprom-1715"
          ? "/media/catalog-eprom-960.webp"
          : nftImage(record.imageURI);
  return `<article class="nft-card"><div class="record-artwork">${image ? `<img src="${esc(image)}" alt="${esc(record.title)} — artwork from token metadata" ${cachedArtwork.includes(record.id) ? `srcset="/media/${record.id}-480.webp 480w, /media/${record.id}-960.webp 960w" sizes="${compact ? "110px" : "(max-width: 700px) 90vw, 30vw"}"` : ""} loading="lazy" decoding="async">` : '<div class="nft-film-label">An audiovisual work</div>'}<button class="artwork-play" data-nft="${record.id}" aria-label="Play ${esc(record.title)}" aria-pressed="false"><span aria-hidden="true">▶</span></button></div><div><p class="small-label">${esc(record.artist)}</p><h3>${esc(record.title)}</h3>${compact ? "" : `<p>${esc(record.note)}</p>`}${record.credits?.length ? `<ul class="record-credits">${record.credits.map((credit) => `<li><a href="${detailHref("person", credit.personId)}">${esc(personById(credit.personId).name)}</a><span>${esc(credit.role)}</span></li>`).join("")}</ul>` : ""}<button class="queue-add" data-queue="${record.id}" aria-label="Add ${esc(record.title)} to queue">＋ Add to queue</button><details><summary>The edition & collection</summary><p>${chainName(record.chainId)} · Token ${esc(record.tokenId)}</p><a href="https://${explorer(record.chainId)}/token/${record.contract}?a=${record.tokenId}" target="_blank" rel="noopener noreferrer">Inspect this edition ↗</a><a href="#/collection/${record.id}">Explore this collection here ↗</a>${record.originalRelease ? `<a href="${esc(record.originalRelease)}" target="_blank" rel="noopener noreferrer">Original release page (may be offline) ↗</a>` : ""}<p>Artist credit follows token metadata and the linked release. This selection is not the artist’s complete catalogue.</p></details></div></article>`;
}
function recordingSelection() {
  const p = params();
  return nftCatalog
    .filter(
      (r) =>
        (!p.get("q") ||
          [
            r.artist,
            r.title,
            r.note,
            r.collection,
            r.platform,
            ...(r.personIds || []).map((id) => personById(id)?.name || ""),
            /\b(Aly|Lackhoney)\b/i.test(`${r.artist} ${r.title} ${r.note}`)
              ? "Aly Lackhoney"
              : "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(p.get("q").toLowerCase())) &&
        (!p.get("artist") ||
          r.artist === p.get("artist") ||
          r.personIds?.some(
            (id) => personById(id)?.name === p.get("artist"),
          )) &&
        (!p.get("platform") || r.platform === p.get("platform")) &&
        (!p.get("chain") || String(r.chainId) === p.get("chain")) &&
        (!p.get("collection") || r.collection === p.get("collection")) &&
        (!p.get("media") || r.kind === p.get("media")),
    )
    .sort((a, b) =>
      p.get("sort") === "artist"
        ? a.artist.localeCompare(b.artist)
        : a.title.localeCompare(b.title),
    );
}
function recordFilter(key, label, values) {
  return `<label>${label}<select data-record-filter="${key}" aria-label="${label}"><option value="">${key === "sort" ? "Title (A–Z)" : `All ${label.toLowerCase()}`}</option>${values.map(([value, text]) => `<option value="${esc(value)}" ${params().get(key) === value ? "selected" : ""}>${esc(text)}</option>`).join("")}</select></label>`;
}
function recordsView() {
  const list = recordingSelection();
  const values = (key) =>
    [...new Set(nftCatalog.map((r) => r[key]).filter(Boolean))]
      .sort()
      .map((v) => [v, v]);
  return `<section class="records-page"><a href="#/">← Return to the documentary</a><p class="small-label">The recordings behind the story</p><h1>Put the record on.</h1><p class="deck">Songs, music videos, performances and experiments. Play the original NFT media from the artwork.</p><label for="record-search">Find an artist, song or credit</label><input id="record-search" type="search" value="${esc(params().get("q") || "")}" placeholder="Try Songcamp, Heno., a collaborator…"><div class="record-filters">${recordFilter(
    "artist",
    "Artists",
    [
      ...new Set(
        nftCatalog.flatMap((r) => [
          r.artist,
          ...(r.personIds || [])
            .map((id) => personById(id)?.name)
            .filter(Boolean),
        ]),
      ),
    ]
      .sort()
      .map((name) => [name, name]),
  )}${recordFilter(
    "chain",
    "Chains",
    [...new Set(nftCatalog.map((r) => r.chainId))].map((id) => [
      String(id),
      chainName(id),
    ]),
  )}${recordFilter("platform", "Platforms", values("platform"))}${recordFilter("collection", "Collections", values("collection"))}${recordFilter(
    "media",
    "Media",
    [
      ["audio", "Audio"],
      ["video", "Video / audiovisual"],
    ],
  )}${recordFilter("sort", "Sort", [
    ["title", "Title"],
    ["artist", "Artist"],
  ])}<a href="#/records">Clear filters</a></div><p class="record-coverage" role="status">${list.length} selected works · ${new Set(list.map((r) => r.contract)).size} contracts. Partial coverage; editions are not distinct songs.</p><div class="nft-grid">${list.map((record) => nftCard(record)).join("") || "<p>No verified work matches these filters. Clear a filter to explore more.</p>"}</div></section>`;
}
function updateRecordingFilters() {
  stopRecord();
  const p = new URLSearchParams();
  const q = document.querySelector("#record-search").value;
  if (q) p.set("q", q);
  document.querySelectorAll("[data-record-filter]").forEach((el) => {
    if (el.value) p.set(el.dataset.recordFilter, el.value);
  });
  history.replaceState(
    { ...history.state },
    "",
    "#/records" + (p.size ? "?" + p : ""),
  );
  lastRenderedHref = location.href;
  const list = recordingSelection();
  document.querySelector(".nft-grid").innerHTML =
    list.map((record) => nftCard(record)).join("") ||
    "<p>No verified work matches these filters. Clear a filter to explore more.</p>";
  linkPeople(document.querySelector(".nft-grid"));
  document.querySelector(".record-coverage").textContent =
    `${list.length} selected works · ${new Set(list.map((r) => r.contract)).size} contracts. Partial coverage; editions are not distinct songs.`;
}
function collectionView(id) {
  const record = nftCatalog.find((r) => r.id === id);
  if (!record)
    return '<section class="records-page"><h1>Collection not found.</h1><a href="#/records">Return to recordings</a></section>';
  return `<section class="records-page"><a href="#/records?q=${encodeURIComponent(record.artist)}">← Artist’s selected collections</a><p class="small-label">${esc(record.artist)} / ${chainName(record.chainId)} collection</p><h1>${esc(record.collection || record.title)}</h1><p class="deck">Explore editions from this contract. The index finds the tokens; each player separately reads its metadata from its original chain.</p><p>This contract may contain multiple releases or editions. Shared protocol contracts can also include other artists and non-music works; this is not an artist or platform’s complete discography.</p><button class="button primary" data-nft="${record.id}">▶ Play the featured edition</button><p id="collection-status" role="status">Loading the collection index…</p><div id="collection-items" class="nft-grid"></div><button id="collection-more" class="button secondary" hidden>Load more editions</button></section>`;
}
let collectionController;
async function loadCollection(id, cursor = null) {
  collectionController?.abort();
  const controller = new AbortController();
  collectionController = controller;
  const status = document.querySelector("#collection-status"),
    more = document.querySelector("#collection-more");
  if (!status) return;
  more.disabled = true;
  status.textContent = "Loading the collection index…";
  try {
    const res = await fetch(
      "/api/collection/" +
        id +
        (cursor ? "?cursor=" + encodeURIComponent(cursor) : ""),
      { signal: controller.signal },
    );
    const data = await res.json();
    if (controller.signal.aborted || base() !== "#/collection/" + id) return;
    if (data.status !== "indexed") throw Error("index unavailable");
    const html = data.items
      .map(
        (item) =>
          `<article class="nft-card"><div class="record-artwork">${item.imageURL ? `<img src="${esc(item.imageURL)}" loading="lazy" alt="${esc(item.title)} — indexed token artwork">` : '<div class="nft-film-label">Artwork unavailable</div>'}<button class="artwork-play" data-nft="${id}" data-token="${esc(item.tokenId)}" data-title="${esc(item.title)}" aria-label="Play ${esc(item.title)}" aria-pressed="false"><span aria-hidden="true">▶</span></button></div><div><h3>${esc(item.title)}</h3><button class="queue-add" data-queue="${id}" data-queue-token="${esc(item.tokenId)}" data-queue-title="${esc(item.title)}" data-queue-image="${esc(item.imageURL || "")}" aria-label="Add ${esc(item.title)} to queue">＋ Add to queue</button><details><summary>The edition & collection</summary><p>Token ${esc(item.tokenId)}</p></details></div></article>`,
      )
      .join("");
    document
      .querySelector("#collection-items")
      .insertAdjacentHTML("beforeend", html);
    status.textContent = `${document.querySelectorAll("#collection-items .nft-card").length} editions loaded. Indexed artwork; media is verified against the contract when you open a player.`;
    more.hidden = !data.nextCursor;
    more.disabled = false;
    more.textContent = "Load more editions";
    more.onclick = () => loadCollection(id, data.nextCursor);
  } catch {
    if (!controller.signal.aborted) {
      status.textContent =
        "The index could not be reached. The featured edition can still be read directly from its original chain.";
      more.hidden = false;
      more.disabled = false;
      more.textContent = "Retry collection index";
      more.onclick = () => loadCollection(id, cursor);
    }
  }
}

let nftController;
let activeRecord;
function playbackState(button, state) {
  if (!button.classList.contains("artwork-play")) {
    button.textContent = {
      play: "▶ Play",
      pause: "Ⅱ Pause",
      loading: "Loading…",
      retry: "↻ Retry play",
    }[state];
    return;
  }
  button.dataset.state = state;
  button.innerHTML = `<span aria-hidden="true">${{ play: "▶", pause: "Ⅱ", loading: "", retry: "↻" }[state]}</span>`;
  const record = nftCatalog.find((r) => r.id === button.dataset.nft);
  button.setAttribute(
    "aria-label",
    `${{ play: "Play", pause: "Pause", loading: "Loading", retry: "Retry" }[state]} ${button.dataset.title || record?.title || "recording"}`,
  );
  button.setAttribute("aria-pressed", String(state === "pause"));
}

function stopRecord() {
  activeRecord?.recovery?.dispose();
  nftController?.abort();
  nftController = null;
  if (!activeRecord) return;
  const { media, button, panel } = activeRecord;
  media?.pause();
  media?.removeAttribute("src");
  media?.load();
  clearTimeout(activeRecord.mediaTimeout);
  panel.remove();
  activeRecord.provenance?.remove();
  playbackState(button, "play");
  button.setAttribute("aria-pressed", "false");
  activeRecord = null;
}
async function listenNFT(id, tokenId, button) {
  collectionPlayer.pause();
  const record = nftCatalog.find((r) => r.id === id);
  if (!record || !button) return;
  if (activeRecord?.button === button && activeRecord.media) {
    const media = activeRecord.media;
    if (media.paused) {
      activeRecord.wanted = true;
      try {
        await media.play();
      } catch {}
    } else {
      activeRecord.wanted = false;
      media.pause();
    }
    return;
  }
  stopListening();
  stopRecord();
  button.dataset.playLabel ||= button.textContent;
  playbackState(button, "loading");
  const panel = document.createElement("div");
  panel.className = "inline-record-player";
  const status = document.createElement("p");
  status.className = "inline-player-status";
  status.setAttribute("role", "status");
  status.textContent = "Finding the original recording…";
  panel.append(status);
  button.after(panel);
  const controller = new AbortController();
  nftController = controller;
  activeRecord = { button, panel, media: null, wanted: true };
  const timeout = setTimeout(() => controller.abort(), 24000);
  try {
    const response = await fetch(
      "/api/nft/" +
        id +
        (tokenId ? "?token=" + encodeURIComponent(tokenId) : ""),
      { signal: controller.signal },
    );
    const data = await response.json();
    if (nftController !== controller) return;
    if (data.status !== "live") throw Error("Unavailable");
    const media = document.createElement(
      tokenId || data.kind === "video" ? "video" : "audio",
    );
    media.controls = !button.classList.contains("artwork-play");
    media.playsInline = true;
    media.preload = "none";
    media.setAttribute("aria-label", data.title);
    media.src = data.mediaURL;
    if (media.tagName === "VIDEO" && data.imageURL)
      media.poster = data.imageURL;
    activeRecord.media = media;
    const failed = () => {
      status.textContent =
        "This recording couldn’t load. Try again or open the original file.";
      playbackState(button, "retry");
      media.pause();
      media.removeAttribute("src");
      media.load();
      if (activeRecord?.button === button) activeRecord.media = null;
      playbackState(button, "retry");
    };
    const recovery = createMediaRecovery(media, {
      originalURL: data.mediaURL,
      shouldPlay: () => nftController === controller && activeRecord?.wanted,
      onSwitch: () => {
        status.textContent = "Trying another gateway for the same recording…";
      },
      onExhausted: failed,
    });
    activeRecord.recovery = recovery;
    media.addEventListener("playing", () => {
      playbackState(button, "pause");
      button.setAttribute("aria-pressed", "true");
      status.textContent = "";
      if (activeRecord?.button === button)
        clearTimeout(activeRecord.mediaTimeout);
    });
    media.addEventListener("pause", () => {
      playbackState(button, "play");
      button.setAttribute("aria-pressed", "false");
    });
    media.addEventListener("ended", () => {
      playbackState(button, "play");
    });
    panel.prepend(media);
    const provenance = document.createElement("details");
    provenance.className = "nft-provenance";
    provenance.innerHTML = `<summary>Recording source</summary><p>${chainName(data.chainId)} block ${esc(data.blockNumber)} · token ${esc(data.tokenId)}</p><p>Contract <code>${esc(data.contract)}</code></p><p><code>${esc(data.mediaURI)}</code></p><a href="${esc(data.mediaURL)}" target="_blank" rel="noopener noreferrer">Open original file ↗</a>`;
    if (button.classList.contains("artwork-play")) {
      button.closest(".nft-card").querySelector("details").append(provenance);
    } else panel.append(provenance);
    activeRecord.provenance = provenance;
    activeRecord.mediaTimeout = setTimeout(() => {
      if (nftController === controller && media.currentTime === 0) failed();
    }, 20000);
    status.textContent = "Loading the recording…";
    try {
      await media.play();
    } catch (error) {
      if (nftController !== controller) return;
      if (error.name === "NotAllowedError") {
        playbackState(button, "play");
        status.textContent = "Press play to start.";
      } else if (error.name !== "AbortError") recovery.recover(data.mediaURL);
    }
  } catch {
    if (nftController === controller) {
      status.textContent =
        "The original recording is unavailable right now. Try again.";
      playbackState(button, "retry");
    }
  } finally {
    clearTimeout(timeout);
  }
}

function explore() {
  return `<section class="explore-page"><div class="explore-heading"><div><p class="small-label">The wider orbit</p><h1>Follow the people.<br>Keep the context.</h1></div><p>Some made songs together. Some shared a stage, a platform, or a publication. Every connection here says which.</p></div><div class="explore-controls"><div role="group" aria-label="Explore view"><button data-view="moments" class="selected" aria-pressed="true">Moments <span>${moments.length}</span></button><button data-view="people" aria-pressed="false">People & projects <span>${people.length}</span></button></div><label class="search-box"><span class="sr-only">Search moments or people</span><span aria-hidden="true">⌕</span><input type="search" id="search" placeholder="A name, a song, a place…" autocomplete="off"></label></div><p class="scope-note">A sourced selection, not a complete census. Network Archives credits are included in full as listed; the complete CHAOS roster is still being reconciled.</p><div id="explore-results"></div></section>`;
}

function renderResults(view = "moments", query = "") {
  const target = document.querySelector("#explore-results");
  if (!target) return;
  const term = query.trim().toLowerCase();
  if (view === "people") {
    const list = people
      .filter((p) =>
        `${p.name} ${(p.aliases || []).join(" ")} ${p.role} ${p.groups.join(" ")}`
          .toLowerCase()
          .includes(term),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
    target.innerHTML = `<p class="result-count" role="status">${list.length} people, projects and platforms</p><div class="people-index">${list.map((p) => `<a href="${detailHref("person", p.id)}">${portrait(p.id) ? photo(portrait(p.id), "index-avatar") : `<span class="index-avatar">${esc(p.name.slice(0, 1))}</span>`}<div><h2>${esc(p.name)}</h2><p>${esc(p.role)}</p></div><span>↗</span></a>`).join("")}</div>${!list.length ? '<div class="empty"><h2>No match in this chapter.</h2><p>Try a surname, a project, or clear the search. Missing from this selection does not mean absent from the scene.</p></div>' : ""}`;
  } else {
    const list = moments
      .filter((m) =>
        `${m.title} ${m.short} ${m.body} ${m.people.map((id) => personById(id).name).join(" ")}`
          .toLowerCase()
          .includes(term),
      )
      .sort((a, b) => a.year - b.year);
    target.innerHTML = `<p class="result-count" role="status">${list.length} moments · dates shown at the precision the sources support</p><div class="moment-index">${list.map((m) => `<a href="#/moment/${m.id}">${photo(sceneVisual(m.id), "index-photo")}<span class="index-date">${esc(m.date)}</span><span><small>${esc(m.type)}</small><h2>${esc(m.short)}</h2><p>${esc(m.deck)}</p></span><span class="index-arrow">↗</span></a>`).join("")}</div>${!list.length ? '<div class="empty"><h2>No match in this chapter.</h2><p>Clear the search or try an artist’s name.</p></div>' : ""}`;
  }
}

function about() {
  return `<article class="about-page"><a class="back-link" href="#/">← Back to the exhibition</a><p class="small-label">About this experiment</p><h1>A small slice.<br>Room to go deep.</h1><p class="deck">Music Nerd can hold the knowledge. An experience can help us feel the connections.</p><p>This is a selected history of artists experimenting with the systems around their music. Its main story follows overlapping communities and releases in 2021–2023, with earlier experiments from 2015 and 2020 and an aftermath reaching into 2026. We go deepest inside Songcamp’s CHAOS, then follow credited work, gatherings and artist-built tools into related projects. It is one connected route through the Music NFT era, not its definitive origin story or a complete account of every community, platform or release.</p><h2>What kind of connection?</h2><dl class="evidence-key"><dt>Made together</dt><dd>A named creative credit or participant account.</dd><dt>Shared event</dt><dd>A reported performance or announced billing. Those are distinguished.</dd><dt>Shared publication</dt><dd>Credited in the same archive. No friendship or musical collaboration is implied.</dd><dt>Collected</dt><dd>A transaction or holding. Useful as a research lead, not proof of influence.</dd></dl><h2>What comes from where?</h2><p>The historical moments and connections are locally authored, source-backed fixtures. Three independently matched artist identities—Dutchyyy, Sound of Fractures and Three Oscillators—can be checked live against Music Nerd’s public directory when their detail opens. Nothing here writes to Music Nerd or reads private Lore.</p><p>NFT playback reads token metadata on Ethereum, Optimism, Base and Zora on request and follows the original media address. Selected collections can be explored here through a public index; individual playback verifies the token against its original chain. This is partial cross-chain coverage, not complete artist discographies or verified ownership of artist wallets. Separate official Bandcamp embeds remain available. Artist photographs come from press materials; Songcamp imagery comes from its CC0lab repository. Image captions link to their sources and distinguish portraits from event evidence. CC0lab imagery illustrates the later project and is not the original CHAOS cover. Rae Isla’s performance photograph is by Fede Petro. All other photograph credits are as supplied by the linked press sources.</p><h2>The record is unfinished</h2><p>The complete CHAOS contributor roster has not been recovered. Early plans and later retrospectives differ on song counts, duration and participant totals. The named contributors here are a verified subset. A dated, contributor-reviewed roster is the next research step.</p><p>Pete’s public collection was inspected as a source of leads. A partial Ethereum inventory surfaced releases by Black Dave and others; it is neither a complete cross-chain inventory nor evidence of creative collaboration. Raw wallet records are not included in this exhibit.</p><h2>Another perspective</h2><p>Benjamin James, also known as musicben, documented music NFTs and now publishes STVDIO. His <a href="${sources.ben.url}" target="_blank" rel="noopener noreferrer">2025 retrospective</a> provides a later view of the platforms’ changing fortunes.</p><h2>Were you there?</h2><p>Use “Suggest a correction on GitHub” in a chapter’s Sources & context or a source panel. Include what needs changing and a public source. GitHub sign-in is required; nothing is submitted until you choose to post.</p><a class="button primary" href="#/explore">Explore the evidence ↗</a><h2>Source index</h2><div class="source-index">${Object.entries(
    sources,
  )
    .map(
      ([id, s]) =>
        `<a href="${detailHref("source", id)}"><span>${esc(s.kind)} · ${esc(s.date)}</span><strong>${esc(s.title)}</strong></a>`,
    )
    .join("")}</div></article>`;
}

// Enhance editorial text only. Never rewrite controls, URLs or existing links.
const ambiguousNames = new Set([
  "dot",
  "sunday",
  "early",
  "papa",
  "fran",
  "dav",
]);
const nameEntries = people.flatMap((p) =>
  [p.name, ...(p.aliases || [])].map((name) => [name, p.id]),
);
const nameLookup = new Map(
  nameEntries.map(([name, id]) => [name.toLowerCase(), id]),
);
const namePattern = new RegExp(
  String.raw`(?<![\p{L}\p{N}_])(${[
    ...new Set(nameEntries.map(([name]) => name)),
  ]
    .sort((a, b) => b.length - a.length)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")})(?![\p{L}\p{N}_])`,
  "giu",
);
function linkPeople(root, currentPerson) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) {
    const node = walker.currentNode,
      el = node.parentElement;
    if (
      !el?.closest("p,h1,h2,h3,li,dd,figcaption") ||
      el.closest(
        "a,button,script,style,select,textarea,#sheet-title,.source-url,.image-credit,[contenteditable]",
      )
    )
      continue;
    nodes.push(node);
  }
  for (const node of nodes) {
    const text = node.textContent;
    const matches = [...text.matchAll(namePattern)].filter((match) => {
      const id = nameLookup.get(match[0].toLowerCase());
      return (
        id !== currentPerson &&
        (!["sound", "glass", "catalog"].includes(match[0].toLowerCase()) ||
          /^[A-Z]/.test(match[0])) &&
        (!ambiguousNames.has(match[0].toLowerCase()) ||
          node.parentElement.closest(".nft-card"))
      );
    });
    if (!matches.length) continue;
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const match of matches) {
      fragment.append(document.createTextNode(text.slice(cursor, match.index)));
      const a = document.createElement("a");
      a.className = "person-mention";
      a.href = detailHref("person", nameLookup.get(match[0].toLowerCase()));
      a.textContent = match[0];
      a.setAttribute("aria-haspopup", "dialog");
      const entry = personById(nameLookup.get(match[0].toLowerCase()));
      a.title = entry.kind
        ? `${entry.name}: ${entry.role}. Open context.`
        : `Explore ${entry.name}`;
      fragment.append(a);
      cursor = match.index + match[0].length;
    }
    fragment.append(document.createTextNode(text.slice(cursor)));
    node.replaceWith(fragment);
  }
}
function personLinks(p) {
  const links = [...(p.links || [])];
  const image = portrait(p.id);
  if (
    image?.url &&
    /metalabel\.com\/(profile|[^/]+$)|bandcamp\.com|instagram\.com|musicnerd\.net\/artist/.test(
      image.url,
    )
  )
    links.push({
      label: new URL(image.url).hostname.includes("metalabel")
        ? "Metalabel profile"
        : "Artist profile",
      url: image.url,
    });
  const unique = [...new Map(links.map((link) => [link.url, link])).values()];
  return unique.length
    ? `<nav class="person-socials" aria-label="${esc(p.name)} online">${unique.map((link) => `<a href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">${esc(link.label)} ↗</a>`).join("")}</nav>`
    : "";
}

function personPanel(id) {
  const p = personById(id);
  if (!p)
    return '<h2 id="sheet-title">Person not found</h2><p>This person is not in the verified selection.</p>';
  const edges = relationships.filter((r) => r.from === id || r.to === id);
  const linked = moments.filter(
    (m) =>
      p.moments?.includes(m.id) ||
      m.people.includes(id) ||
      [
        ...`${m.title} ${m.deck} ${m.body} ${(closeReads[m.id] || []).map((part) => part.text).join(" ")}`.matchAll(
          namePattern,
        ),
      ].some(
        (match) =>
          nameLookup.get(match[0].toLowerCase()) === id &&
          !ambiguousNames.has(match[0].toLowerCase()),
      ),
  );
  return `${portrait(id) ? `<figure class="person-portrait">${photo(portrait(id), "", true)}<figcaption>${imageCredit(portrait(id))}</figcaption></figure>` : ""}<p class="small-label">${esc(p.kind ? `${p.kind}, in context` : "A person, in context")}</p><h2 id="sheet-title">${esc(p.name)}</h2><p class="deck">${esc(p.role)}</p><div class="person-bio">${p.bio
    .split("\n\n")
    .map((paragraph) => `<p>${esc(paragraph)}</p>`)
    .join(
      "",
    )}</div>${personLinks(p)}${!p.kind && p.aliases?.length ? `<p>Also credited as ${p.aliases.map(esc).join(", ")}. Original release credits are preserved.</p>` : ""}<div id="directory-status">${identities[id] ? '<p class="muted">Checking the confirmed Music Nerd identity…</p>' : ""}</div>${
    nftCatalog.some(
      (r) =>
        r.personIds?.includes(id) ||
        r.artistId === id ||
        r.artistIds?.includes(id),
    )
      ? `<h3>Experience the work</h3><div class="artist-nfts">${nftCatalog
          .filter(
            (r) =>
              r.personIds?.includes(id) ||
              r.artistId === id ||
              r.artistIds?.includes(id),
          )
          .slice(0, 3)
          .map((r) => nftCard(r, true))
          .join(
            "",
          )}</div><a href="#/records?q=${encodeURIComponent(p.name)}">Browse all indexed work ↗</a>`
      : ""
  }${
    edges.length
      ? `<h3>Documented connections</h3>` +
        edges
          .map((r) => {
            const other = personById(r.from === id ? r.to : r.from);
            return `<div class="relationship"><span class="small-label">${esc(r.type)}</span><a class="relationship-name" href="${detailHref("person", other.id)}">${esc(other.name)} ↗</a><p>${esc(r.note)}</p><a href="${detailHref("source", r.source)}">Inspect evidence</a> <span class="muted">/</span> <a href="#/moment/${r.moment}">Open moment</a></div>`;
          })
          .join("")
      : ""
  }<h3>${p.kind ? "Sources for this context" : "Identity and credit sources"}</h3>${p.sources.map((sid) => `<a class="panel-moment" href="${detailHref("source", sid)}"><small>Read the evidence · ${esc(sources[sid].date)}</small><strong>${esc(sources[sid].title)}</strong><span class="panel-action">Open source notes →</span></a>`).join("")}${linked.length ? "<h3>Continue into the story</h3><p class='panel-guide'>These open a related story. Use your browser’s Back button to return here.</p>" : ""}${linked.map((m) => `<a class="panel-moment" href="#/moment/${m.id}"><small>${esc(m.date)}</small><strong>${esc(m.short)}</strong><span class="panel-action">Read this story →</span></a>`).join("")}<div class="panel-footnote">${p.kind ? "This is a period-specific account. Follow the dated sources to distinguish the original experiment from later changes." : "Credits are roles, not a ranking. This record may be incomplete."}</div>`;
}

function correctionLink(title, context) {
  const query = new URLSearchParams({
    title: `Correction: ${title}`,
    body: `Page or source: ${context}\n\nWhat should change?\n\nSupporting public source URL(s):\n\nYour connection to this history (optional):\n`,
  });
  return `<a class="correction-link" href="https://github.com/xdjs/music-nft-era/issues/new?${esc(query.toString())}" target="_blank" rel="noopener noreferrer">Suggest a correction on GitHub ↗</a>`;
}
function sourcePanel(id) {
  const s = sources[id];
  if (!s)
    return '<h2 id="sheet-title">Source not found</h2><p>The link may be incomplete. Close this panel to keep exploring.</p>';
  const related = moments.filter((m) => m.sources.includes(id));
  return `<p class="small-label">${esc(s.kind)}</p><h2 id="sheet-title">${esc(s.title)}</h2><p class="source-by">${esc(s.by)}</p><p class="source-date">${esc(s.date)}</p><h3>What this supports</h3><p>${esc(s.note)}</p><a class="button primary" href="${s.url}" target="_blank" rel="noopener noreferrer">Open original source ↗</a><p class="muted source-url">${esc(s.url)}</p><h3>Used in this chapter</h3>${related.map((m) => `<a class="panel-moment" href="#/moment/${m.id}"><small>${esc(m.date)}</small><strong>${esc(m.short)}</strong><span class="panel-action">Read this story →</span></a>`).join("")}<h3>Read with care</h3><p>Publication date, event date and date recalled are different things. A participant account is attributed; an interpretation is labeled. Sources were checked during research in November 2026; external sites can change.</p>${correctionLink(s.title, s.url)}`;
}

async function refreshDirectory(id) {
  if (!identities[id]) return;
  directoryController?.abort();
  directoryController = new AbortController();
  const controller = directoryController;
  const timeout = setTimeout(() => controller.abort(), 8000);
  let result;
  try {
    const r = await fetch(`/api/directory/${id}`, {
      signal: controller.signal,
    });
    result = r.ok ? await r.json() : { status: "unavailable" };
  } catch {
    result = { status: "unavailable" };
  } finally {
    clearTimeout(timeout);
  }
  if (params().get("person") !== id || directoryController !== controller)
    return;
  const el = document.querySelector("#directory-status");
  if (!el) return;
  el.innerHTML =
    result.status === "live"
      ? `<a class="directory-link" href="https://musicnerd.net/artist/${identities[id].id}" target="_blank" rel="noopener noreferrer"><span class="live-dot"></span> Open Music Nerd profile ↗</a><p class="muted">Identity checked live against a confirmed artist reference.</p>`
      : `<p class="muted">${result.status === "unconfirmed" ? "The current directory result could not be confirmed." : "Music Nerd is taking a moment. The sourced story is still available."}</p><button class="quiet" data-retry="${id}">Try directory again</button>`;
}

function stopListening() {
  stopRecord();
  nftController?.abort();
  nftController = null;
  document.querySelectorAll("#player audio, #player video").forEach((m) => {
    m.pause();
    m.removeAttribute("src");
    m.load();
  });
  clearTimeout(mediaTimer);
  document.querySelector("#player").replaceChildren();
  if (listening.open) listening.close();
}
function listen(id) {
  collectionPlayer.pause();
  const m = momentById(id);
  if (!m?.album) return;
  lastFocus = document.activeElement;
  stopListening();
  document.querySelector("#listen-title").textContent = m.listenLabel;
  document.querySelector("#listen-context").textContent =
    "Official Bandcamp player, separate from NFT playback. Press play below.";
  document.querySelector("#player-fallback").textContent =
    "Open the artist’s Bandcamp ↗";
  const fallback = document.querySelector("#player-fallback");
  fallback.href = m.id === "scenes" ? sources.scenes.url : sources.remixes.url;
  const status = document.querySelector("#player-status");
  status.textContent = "Loading the official player…";
  const iframe = document.createElement("iframe");
  iframe.title = m.listenLabel + " — official Bandcamp player";
  iframe.src = `https://bandcamp.com/EmbeddedPlayer/album=${m.album}/size=large/bgcol=ffffff/linkcol=333333/artwork=small/transparent=true/`;
  iframe.loading = "eager";
  iframe.allow = "encrypted-media";
  iframe.addEventListener("load", () => {
    clearTimeout(mediaTimer);
    status.textContent =
      "If the player cannot play here, open the artist’s release below.";
  });
  document.querySelector("#player").append(iframe);
  mediaTimer = setTimeout(() => {
    status.textContent =
      "The player is taking longer than expected. You can listen on the artist’s Bandcamp below.";
  }, 9000);
  listening.showModal();
}

function navigate(href, replace = false) {
  const oldBase = base(),
    newBase = href.split("?")[0],
    isDetail = /[?&](person|source)=/.test(href);
  history.replaceState(
    { ...history.state, scroll: scrollY },
    "",
    location.href,
  );
  const depth =
    isDetail && oldBase === newBase
      ? (history.state?.depth || 0) + 1
      : isDetail
        ? 1
        : 0;
  const state = { depth, scroll: 0 };
  if (replace) history.replaceState(state, "", href);
  else history.pushState(state, "", href);
  render(false);
}

function closeSheet() {
  if (history.state?.depth > 0) history.go(-history.state.depth);
  else {
    const p = params();
    p.delete("person");
    p.delete("source");
    navigate(base() + (p.size ? "?" + p : ""), true);
  }
}

function render(pop = false) {
  if (lastRenderedHref === location.href) return;
  const previousHref = lastRenderedHref;
  lastRenderedHref = location.href;
  const recordingFilters = (href) => {
    const query = new URLSearchParams(href.split("?")[1] || "");
    query.delete("person");
    query.delete("source");
    query.sort();
    return query.toString();
  };
  const hasPreviousPage = Boolean(currentBase);
  const route = base();
  const changed = route !== currentBase;
  if (changed) {
    stopListening();
    collectionController?.abort();
    if (sheet.open) sheet.close();
    const parts = route.split("/");
    const m = parts[1] === "moment" ? momentById(parts[2]) : null;
    let html =
      route === "#/"
        ? home()
        : route.startsWith("#/collection/")
          ? collectionView(parts[2])
          : route === "#/records"
            ? recordsView()
            : route === "#/explore"
              ? explore()
              : route === "#/about"
                ? about()
                : m
                  ? momentView(m)
                  : `<section class="about-page"><h1>This thread isn’t here.</h1><p>The link may be incomplete. The chapter is still ready to explore.</p><a class="button primary" href="#/">Back to the opening</a></section>`;
    const update = () => {
      document.body.classList.toggle("is-film", route === "#/");
      main.innerHTML = html;
      observeStory();
      currentBase = route;
      document.title =
        (m
          ? m.short
          : route === "#/explore"
            ? "People & connections"
            : "A scene, in the making") + " — Music Nerd";
    };
    update();
    main.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    if (
      hasPreviousPage &&
      !keyboardInput &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      main.firstElementChild.animate(
        [
          { opacity: 0.2, transform: `translateX(${pop ? -10 : 10}px)` },
          { opacity: 1, transform: "translateX(0)" },
        ],
        { duration: 240, easing: "cubic-bezier(.2,.7,.2,1)" },
      );
    const sceneImage = main.querySelector(".scene-image");
    if (
      sceneImage &&
      !keyboardInput &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      sceneImage.animate(
        [{ transform: "scale(1.045)" }, { transform: "scale(1)" }],
        { duration: 700, easing: "cubic-bezier(.2,.7,.2,1)" },
      );
    }
    if (route.startsWith("#/collection/")) loadCollection(parts[2]);
    if (route === "#/explore") {
      const q = params().get("q") || "",
        view = params().get("view") === "people" ? "people" : "moments";
      document.querySelector("#search").value = q;
      setExploreView(view, q);
    }
    window.scrollTo({
      top: pop ? history.state?.scroll || 0 : 0,
      behavior: "instant",
    });
    if (hasPreviousPage) main.focus({ preventScroll: true });
  }
  if (
    route === "#/records" &&
    !changed &&
    recordingFilters(previousHref) !== recordingFilters(location.href)
  ) {
    stopRecord();
    main.innerHTML = recordsView();
  }
  linkPeople(main);
  if (activeRecord?.button && sheet.contains(activeRecord.button)) stopRecord();
  const p = params();
  const person = p.get("person"),
    source = p.get("source");
  if (person || source) {
    if (!sheet.open) lastFocus = document.activeElement;
    document.querySelector("#sheet-content").innerHTML = person
      ? personPanel(person)
      : sourcePanel(source);
    linkPeople(document.querySelector("#sheet-content"), person);
    sheet.scrollTop = 0;
    if (!sheet.open) sheet.showModal();
    document.querySelector("#sheet-back").hidden = !(history.state?.depth > 1);
    document.querySelector("#sheet-title")?.setAttribute("tabindex", "-1");
    document.querySelector("#sheet-title")?.focus();
    if (person) refreshDirectory(person);
  } else if (sheet.open) {
    sheet.close();
    directoryController?.abort();
    if (lastFocus?.isConnected) lastFocus.focus({ preventScroll: true });
  }
  if (route === "#/explore" && !person && !source) {
    const q = p.get("q") || "",
      view = p.get("view") === "people" ? "people" : "moments";
    document.querySelector("#search").value = q;
    setExploreView(view, q);
  }
  document
    .querySelector("#chapter-link")
    .setAttribute(
      "aria-current",
      route.startsWith("#/moment") ? "page" : "false",
    );
  document
    .querySelector("#explore-link")
    .setAttribute("aria-current", route === "#/explore" ? "page" : "false");
  document.querySelector("#announcement").textContent = person
    ? personById(person)?.name || "Person"
    : source
      ? "Source detail"
      : document.title;
}

function setExploreView(view, query) {
  document.querySelectorAll("[data-view]").forEach((b) => {
    b.classList.toggle("selected", b.dataset.view === view);
    b.setAttribute("aria-pressed", String(b.dataset.view === view));
  });
  renderResults(view, query);
  linkPeople(document.querySelector("#explore-results"));
}

document.addEventListener("click", (e) => {
  if (e.target.closest("[data-play-collection]")) {
    collectionPlayer.start();
    return;
  }
  const jump = e.target.closest("[data-story-jump]");
  if (jump) jump.closest("details")?.removeAttribute("open");
  if (jump) {
    const section = document.getElementById("story-" + jump.dataset.storyJump);
    const heading = section?.querySelector("h2");
    heading?.setAttribute("tabindex", "-1");
    heading?.focus({ preventScroll: true });
    section?.scrollIntoView({
      behavior:
        keyboardInput || matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
    });
    return;
  }
  const a = e.target.closest('a[href^="#/"]');
  if (a && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
    e.preventDefault();
    lastFocus = a;
    navigate(a.getAttribute("href"));
    return;
  }
  const tab = e.target.closest("[data-primer]");
  if (tab) selectPrimer(tab.dataset.primer);
  const add = e.target.closest("[data-queue]");
  if (add) {
    const record = nftCatalog.find((r) => r.id === add.dataset.queue);
    if (record)
      collectionPlayer.enqueue(
        add.dataset.queueToken
          ? {
              ...record,
              tokenId: add.dataset.queueToken,
              playToken: add.dataset.queueToken,
              title: add.dataset.queueTitle || record.title,
              artist: "Collection edition",
              imageURI: add.dataset.queueImage || record.imageURI,
            }
          : record,
      );
  }
  const nft = e.target.closest("[data-nft]");
  if (nft) listenNFT(nft.dataset.nft, nft.dataset.token, nft);
  const play = e.target.closest("[data-listen]");
  if (play) listen(play.dataset.listen);
  const retry = e.target.closest("[data-retry]");
  if (retry) refreshDirectory(retry.dataset.retry);
  const view = e.target.closest("[data-view]");
  if (view) {
    const q = document.querySelector("#search").value;
    const p = new URLSearchParams({ view: view.dataset.view });
    if (q) p.set("q", q);
    history.replaceState({ ...history.state }, "", `#/explore?${p}`);
    setExploreView(view.dataset.view, q);
  }
});
function selectPrimer(id, focus = false) {
  document.querySelectorAll("[data-primer]").forEach((t) => {
    const active = t.dataset.primer === id;
    t.setAttribute("aria-selected", String(active));
    t.tabIndex = active ? 0 : -1;
    if (active && focus) t.focus();
  });
  document
    .querySelectorAll('.nft-primer [role="tabpanel"]')
    .forEach((p) => (p.hidden = p.id !== `primer-${id}`));
}
document.addEventListener("keydown", (e) => {
  const tab = e.target.closest("[data-primer]");
  if (!tab || !["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key))
    return;
  e.preventDefault();
  const ids = ["music", "token", "relationship"];
  const i = ids.indexOf(tab.dataset.primer);
  selectPrimer(
    ids[
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? 2
          : (i + (e.key === "ArrowRight" ? 1 : 2)) % 3
    ],
    true,
  );
});
document.addEventListener("keydown", () => {
  keyboardInput = true;
  document.documentElement.dataset.input = "keyboard";
});
document.addEventListener("pointerdown", () => {
  keyboardInput = false;
  document.documentElement.dataset.input = "pointer";
});
document.addEventListener("input", (e) => {
  if (
    e.target.id === "record-search" ||
    e.target.matches("[data-record-filter]")
  ) {
    updateRecordingFilters();
    return;
  }
  if (e.target.id === "search") {
    const view = document.querySelector("[data-view].selected").dataset.view,
      q = e.target.value;
    const p = new URLSearchParams({ view });
    if (q) p.set("q", q);
    history.replaceState({ ...history.state }, "", `#/explore?${p}`);
    renderResults(view, q);
  }
});
document.querySelector("#sheet-close").onclick = closeSheet;
document.querySelector("#sheet-back").onclick = () => history.back();
sheet.addEventListener("cancel", (e) => {
  e.preventDefault();
  closeSheet();
});
document.querySelector("#listen-close").onclick = stopListening;
listening.addEventListener("cancel", (e) => {
  e.preventDefault();
  stopListening();
});
listening.addEventListener("close", () => {
  if (listening.open) return;
  nftController?.abort();
  nftController = null;
  document.querySelector("#player").replaceChildren();
  if (lastFocus?.isConnected) lastFocus.focus({ preventScroll: true });
});
window.addEventListener("popstate", () => render(true));
window.addEventListener("hashchange", () => render(true));
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document
    .querySelector("#theme")
    .setAttribute(
      "aria-label",
      `Switch to ${theme === "dark" ? "light" : "dark"} theme`,
    );
  try {
    localStorage.setItem("era-theme", theme);
  } catch {}
}
try {
  setTheme(localStorage.getItem("era-theme") || "dark");
} catch {
  setTheme("dark");
}
document.querySelector("#theme").onclick = () =>
  setTheme(
    document.documentElement.dataset.theme === "dark" ? "light" : "dark",
  );
history.scrollRestoration = "manual";
history.replaceState({ depth: 0, scroll: 0 }, "", location.href);
render();

document.addEventListener(
  "error",
  (event) => {
    const img = event.target;
    if (img instanceof HTMLImageElement && img.closest(".nft-card")) {
      const fallback = document.createElement("div");
      fallback.className = "nft-film-label";
      fallback.textContent = "Artwork unavailable";
      img.replaceWith(fallback);
    }
  },
  true,
);
