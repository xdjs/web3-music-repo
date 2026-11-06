import { nftCatalog } from "./nft-catalog.js";
import {
  eraSources,
  eraMoments,
  eraPeople,
  eraRelationships,
  guidedChapter,
} from "./narrative.js";
export const sources = {
  erinMint: {
    title: "12 Steps to Collect a Music NFT & Mint Your Own",
    by: "Erin Ivey · artist account",
    date: "Describes 31 December 2021; accessed 3 November 2026",
    kind: "Primary artist account",
    url: "https://erinivey.com/pages/how-to-collect-your-first-music-nft-step-by-step",
    note: "Ivey describes minting 50 editions on Polygon, onboarding help and delayed listing. The platform song ID 2321 has not been matched to a blockchain token here.",
  },
  ...eraSources,
  remixes: {
    title: "NOKMLY — The Collaborative Remixes",
    by: "Sound of Fractures · artist release notes and credits",
    date: "12 May 2023",
    kind: "Primary release",
    url: "https://sofractures.bandcamp.com/album/nokmly-the-collaborative-remixes",
    note: "Credits Three Oscillators, Scott Quinn, AmbieNFT, Kabuki and Green Ring. Jamie describes connecting artist communities through the remix release.",
  },
  walls: {
    title: "Creating CHAOS: an oral history of “Walls”",
    by: "Austin Robey · Metalabel; participants Boy Untitled, Lackhoney and Three Oscillators",
    date: "29 September 2022",
    kind: "Participant interview",
    url: "https://archive.metalabel.com/magazine/features/creating-chaos-an-oral-history-of-walls",
    note: "The three artists describe their roles and making Walls in Act II. Their recollections are attributed, not independently observed studio events.",
  },
  architecture: {
    title: "How to Build a Headless Band: Architecting Chaos",
    by: "Songcamp",
    date: "2022 · exact date not confirmed here",
    kind: "Organizer account",
    url: "https://paragraph.com/@songcamp/how-to-build-a-headless-band-architecting-chaos",
    note: "Describes an eight-week plan: 45 musicians, rotating trios, houses, alchemy teams, and visual, technical, radio, lore, economics and operations contributors.",
  },
  festival: {
    title: "Chaos Festival",
    by: "Songcamp · original event listing",
    date: "3 June 2022 · year corroborated by contemporary reporting",
    kind: "Event record",
    url: "https://luma.com/chaosfestival",
    note: "Announces the digital listening event and pack release. The page itself uses both 77 and 80 for the band size; an invitation does not establish individual attendance.",
  },
  year: {
    title: "CHAOS: One Year in the Life of a Massive Multiplayer Band",
    by: "Songcamp",
    date: "7 June 2023",
    kind: "Organizer retrospective",
    url: "https://paragraph.com/@songcamp/chaos-one-year-in-the-life-of-a-massive-multiplayer-band",
    note: "Looks back on the release, CC0lab, live events, common pool and pack burn. Describes 48 songs and 12 weeks, unlike the earlier 45-song/eight-week plan.",
  },
  splits: {
    title: "Thing-ing the Internet with Songcamp",
    by: "Splits · interview with Songcamp’s Russell Matthews",
    date: "2024 · includes June 2023 Q&A",
    kind: "Infrastructure participant",
    url: "https://splits.org/blog/songcamp/",
    note: "Explains the payment infrastructure and its collaboration with Songcamp. Payments and ownership are not evidence of friendship.",
  },
  sound: {
    title: "Snoop Dogg’s 4/20 Death Row NFT mix",
    by: "We Got This Covered · contemporary report quoting the release description",
    date: "April 2022",
    kind: "Secondary reporting",
    url: "https://wegotthiscovered.com/music/yes-snoop-dogg-has-4-20-plans-and-that-includes-dropping-a-death-row-nft-mix/",
    note: "Reports the mix’s inclusion of MoRuf, Iman Europe, Black Dave and Heno. The original Sound artist page returned “Page not found” during this review.",
  },
  onboarding: {
    title: "From protocols to people: music NFT platforms’ onboarding",
    by: "Water & Music · platform research",
    date: "2022",
    kind: "Secondary research",
    url: "https://www.waterandmusic.com/from-protocols-to-people-music-nft-platforms-onboarding/",
    note: "Compares artist referral on Sound with open onboarding on Mint Songs, Zora and others. Describes LATASHÁ-led community rooms. A period-specific account, not current product documentation.",
  },
  zoratopia: {
    title: "SXSW 2022 at Empire",
    by: "6th Street Austin · venue event listing",
    date: "March 2022 · dates in listing body",
    kind: "Event listing",
    url: "https://6street.com/events/sxsw-2022-empire/",
    note: "Bills Black Dave at Zoratopia on March 12. The page header has a broken 1969 timestamp; use the explicit 2022 program text, not the header. Billing is not verified attendance.",
  },
  zoraJune: {
    title: "Celebrating Diversity in Web3 at Zoratopia",
    by: "Langston Thomas and Jex Exmundo · nft now",
    date: "24 June 2022",
    kind: "Contemporary reporting",
    url: "https://nftnow.com/culture/celebrating-diversity-in-web3-at-zoratopia/",
    note: "Reports LATASHÁ-led programming across June 21–23, and performances by LATASHÁ and Iman Europe among others.",
  },
  network: {
    title: "Network Archives 001: A Directory of Inspiration",
    by: "Network Archives · release credits",
    date: "December 2024 context; exact release day not confirmed",
    kind: "Primary credits",
    url: "https://networkarchives.metalabel.com/directoryofinspiration",
    note: "Credits Jamie Reddington as curator/editor, C.Y. Lee as executive producer, Jade Garcia as producer and Ana Carolina as designer. The named contributors below are publication credits, not a claim that everyone made a song together.",
  },
  networkReport: {
    title: "Network Archives: The Fractured Sounds of Common Ground",
    by: "MacEagon Voyce · Decential",
    date: "17 December 2024",
    kind: "Reporting by a contributor",
    url: "https://www.decential.io/articles/network-archives-the-fractured-sounds-of-common-ground",
    note: "Contemporary context for the archive’s creation. The writer is also credited in the publication.",
  },
  scenes: {
    title: "SCENES",
    by: "Sound of Fractures · artist release page",
    date: "12 June 2024",
    kind: "Primary release",
    url: "https://sofractures.bandcamp.com/album/scenes",
    note: "Invites listeners’ photographs and memories into an album’s surrounding world. Official Bandcamp player used on demand.",
  },
  xcelencia: {
    title: "El Niño Estrella — álbum inteligente v1",
    by: "Xcelencia",
    date: "6 April 2024",
    kind: "Artist statement",
    url: "https://paragraph.com/@laequis/el-ni-o-estrella-album-inteligente-v1-espa-ol",
    note: "The artist describes an expandable digital box set. Do not conflate the 2024 album with its earlier pass/collectible phase.",
  },
  rae: {
    title: "About Rae Isla",
    by: "Rae Isla · official website",
    date: "Undated · read 3 November 2026",
    kind: "Artist statement",
    url: "https://www.raeisla.com/about",
    note: "Describes her real-life rocks becoming a music NFT collection. This page does not establish an exact launch date.",
  },
  dutch: {
    title: "Thoughtful Jawn [single]",
    by: "Dutchyyy · artist release page",
    date: "2023 · release page",
    kind: "Primary release",
    url: "https://dutchmassive.bandcamp.com/album/thoughtful-jawn-single",
    note: "Describes the HEDSTAPE14 challenge, Harris Cole mastering, a 50/50 split and collection by Stvdio Nouveau. Collection is explicitly distinct from creative authorship.",
  },
  mint: {
    title: "Napster acquires Web3 music startup Mint Songs",
    by: "Music Business Worldwide",
    date: "15 February 2023",
    kind: "Secondary reporting",
    url: "https://www.musicbusinessworldwide.com/napster-acquires-web3-music-startup-mint-songs-after-eight-figure-financing/",
    note: "Reports the acquisition. Historical platform availability is not guaranteed by an NFT’s continuing existence.",
  },
  ben: {
    title: "Web3 Music in 2025: Mapped",
    by: "musicben / Benjamin James · STVDIO",
    date: "1 July 2025",
    kind: "Later analysis",
    url: "https://stvdio.substack.com/p/does-web3-music-still-exist",
    note: "A retrospective on platform pivots, infrastructure and remaining experiments. It is later interpretation, not firsthand evidence of every 2022 event.",
  },
};

const networkNames = [
  "Black Dave MK2",
  "Cam Murdoch",
  "C.Y. Lee",
  "dav",
  "Dot",
  "Dutchyyy",
  "Emma Miller",
  "Forrest Mortifee",
  "LATASHÁ",
  "Maarten Walraven",
  "MacEagon Voyce",
  "Songcamp",
  "Mavi Taylor",
  "MdCL",
  "Nick Smith",
  "Pete Rango",
  "Rae Isla",
  "Sound of Fractures",
  "Supersigil",
  "Talk Time",
  "The Park",
  "TK",
  "VÉRITÉ",
  "Vivid Fever Dreams",
  "WavWRLD",
  "WKSHP",
  "Xcelencia",
  "Yuri Rybak",
];
export const slug = (name) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
export const people = networkNames.map((name) => ({
  id: slug(name),
  name,
  role:
    name === "Sound of Fractures"
      ? "Artist · curator of Network Archives"
      : name === "C.Y. Lee"
        ? "Executive producer · Network Archives"
        : "Credited contributor · Network Archives",
  sources: ["network"],
  groups: ["Network Archives"],
}));
people.push(
  ...[
    ["Three Oscillators", "Producer · Walls", "walls"],
    ["Boy Untitled", "Artist · Walls", "walls"],
    ["Lackhoney", "Flex musician · Walls", "walls"],
    ["Matthew Chaim", "Founder · Songcamp", "walls"],
    ["Mark Redito", "Songcamp member", "walls"],
    ["Greydient", "Songcamp contributor", "walls"],
    ["Peace Node", "Songcamp contributor", "walls"],
    ["Iman Europe", "Artist · Death Row mix / Zoratopia", "sound"],
    ["Snoop Dogg", "Artist · Death Row Session Vol. 2", "sound"],
    ["Heno", "Artist · Death Row mix", "sound"],
    ["MoRuf", "Artist · Death Row mix", "sound"],
    ["Scott Quinn", "Artist · NOKMLY", "remixes"],
    ["AmbieNFT", "Remixer · NOKMLY", "remixes"],
    ["Kabuki", "Remixer · NOKMLY", "remixes"],
    ["Green Ring", "Remixer · NOKMLY", "remixes"],
    ["Harris Cole", "HEDSTAPE14 · mastering", "dutch"],
    ["Jade Garcia", "Producer · Network Archives", "network"],
    ["Ana Carolina", "Designer · Network Archives", "network"],
  ].map(([name, role, source]) => ({
    id: slug(name),
    name,
    role,
    sources: [source],
    groups:
      source === "walls" || source === "architecture"
        ? ["Songcamp / CHAOS"]
        : source === "sound"
          ? ["Sound.xyz"]
          : source === "network"
            ? ["Network Archives"]
            : ["Release credits"],
  })),
);

export const identities = {
  dutchyyy: {
    name: "Dutchyyy",
    id: "efff5473-fa9f-4eba-b137-16ffb79f15d8",
    field: "bandcamp",
    value: "dutchmassive",
  },
  "sound-of-fractures": {
    name: "Sound of Fractures",
    id: "b75dc79f-9e5c-4155-a4c5-ce07010e4b33",
    field: "bandcamp",
    value: "sofractures",
  },
  "three-oscillators": {
    name: "Three Oscillators",
    id: "0aaf94cb-1fc3-4e15-9cb8-9b3149895303",
    field: "instagram",
    value: "threeoscillators",
  },
};

people.push(...eraPeople);
const lackhoney = people.find((p) => p.id === "lackhoney");
lackhoney.aliases = ["Aly"];
lackhoney.sources.push("futureSurf");

export const moments = [
  ...eraMoments,
  {
    id: "remix",
    bridge:
      "This is one connection we can follow through the credits. What else survived as the platforms changed?",
    date: "12 May 2023",
    year: 2023,
    type: "Release",
    title: "Separate worlds. A shared record.",
    short: "A remix becomes a meeting place",
    deck: "Sound of Fractures invited other artists into “No One Knows Me Like You.” The credits offer a way into a much bigger story.",
    body: "Jamie Reddington, who releases as Sound of Fractures, wanted the communities around different artists to meet through music. His NOKMLY remix release brought Scott Quinn together with reinterpretations by AmbieNFT, Three Oscillators, Kabuki and Green Ring. Each remix offered another entrance into the song. Three Oscillators provides a path further into this history: before this release, he had made Walls inside Songcamp’s CHAOS. Following that credit lets us hear one musician in two different collaborative settings, with a different task and a different set of people around the work.",
    interpretation:
      "A release can be a map of a community. Start with the credit, then follow the person.",
    people: [
      "sound-of-fractures",
      "three-oscillators",
      "scott-quinn",
      "ambienft",
      "kabuki",
      "green-ring",
    ],
    sources: ["remixes"],
    related: ["walls", "scenes"],
    color: "pink",
    art: "remix",
    album: "1347599098",
    listenLabel: "NOKMLY · the collaborative remixes",
  },
  {
    id: "walls",
    bridge:
      "Remote collaboration gave strangers a shared song. Gatherings gave online relationships a physical place.",
    date: "2022 · Act II",
    year: 2022,
    type: "Collaboration",
    title: "Two weeks. Three perspectives. One song.",
    short: "Inside a temporary band",
    deck: "Three Oscillators, Boy Untitled and Lackhoney were assigned to make “Walls” together in CHAOS.",
    body: "Lackhoney sent unused vocal demos to the trio. Boy Untitled heard his own relationship in Walls, then reshaped its words and topline. Three Oscillators built the production around the vocal. In their Metalabel interview, the artists describe demo calls, rotating groups and files crossing time zones. CHAOS supplied the structure that put them together; the song took shape through what they recognized and changed in one another’s contributions. The collective experiment becomes easier to understand when it can be heard in the decisions of three people.",
    interpretation:
      "The interesting unit is the room people made together—even when that room was online.",
    people: ["three-oscillators", "boy-untitled", "lackhoney"],
    sources: ["walls"],
    related: ["chaos", "remix"],
    color: "blue",
    art: "trio",
    artifact: "Hear the Walls demo in the original oral history",
    artifactUrl: sources.walls.url,
  },
  {
    id: "chaos",
    bridge:
      "A structure on paper only tells part of the story. Go inside one trio and hear how a song took shape.",
    date: "Spring–June 2022",
    year: 2022,
    type: "Creative camp",
    title: "What if a band had no frontperson?",
    short: "The structure behind CHAOS",
    deck: "Songcamp built a temporary setting for musicians, visual artists, developers, radio producers and organizers to create one shared project.",
    body: "CHAOS made the organization of a band part of the creative experiment. Its launch account described 77 contributors, including 45 musicians. Rotating trios worked in acts, while other participants built artwork, stories, software, radio and the systems around the release.\n\nPacks revealed songs; the June 3, 2022 launch became a digital festival. A listener encountered a larger world than any one recording. The scale is striking, but the more interesting question is how it worked: who made decisions, how contributors shared value, and what happened when a temporary camp became something people wanted to continue.",
    interpretation:
      "Creative freedom can depend on a carefully designed structure.",
    uncertainty:
      "The early plan describes 45 songs and eight weeks; the 2023 retrospective describes 48 songs and twelve weeks. Band-size accounts also vary between 77 and 80. These are different records, not a reconciled census.",
    people: [
      "songcamp",
      "matthew-chaim",
      "mark-redito",
      "greydient",
      "peace-node",
      "three-oscillators",
      "boy-untitled",
      "lackhoney",
    ],
    sources: ["architecture", "festival", "year"],
    related: ["cc0lab", "common-pool", "club-chaos", "splits"],
    color: "mint",
    art: "camp",
    artifact: "Read the original festival invitation",
    artifactUrl: sources.festival.url,
  },
  {
    id: "sound",
    date: "20 April 2022",
    year: 2022,
    type: "Platform / release",
    title: "A familiar voice opened another door.",
    short: "Sound.xyz and the shared mix",
    deck: "Snoop Dogg’s Death Row Session Vol. 2 placed Iman Europe, MoRuf, Black Dave and Heno in the same release.",
    body: "Snoop Dogg’s 4/20 Death Row mix put MoRuf, Iman Europe, Black Dave and Heno. into a release carrying a widely recognized name. For a listener arriving through Snoop, the mix offered a route to musicians they might not yet know. This is one way the scene’s audiences could meet: through the actual sequencing and credits of music, rather than a directory of names. Sound’s artist-referral approach also made introductions part of its early culture. Visibility traveled through people as well as through the platform.",
    interpretation:
      "Platforms mattered partly because of the people who brought other people in.",
    uncertainty:
      "The original Sound artist page was unavailable in this review. This stop relies on named contemporary reporting; original track-level credits remain a follow-up.",
    people: ["snoop-dogg", "iman-europe", "black-dave-mk2", "heno", "moruf"],
    sources: ["sound", "onboarding"],
    related: ["zoratopia", "mint-songs"],
    color: "pink",
    art: "mix",
    artifact: "Read the contemporary release report",
    artifactUrl: sources.sound.url,
  },
  {
    id: "zoratopia",
    bridge:
      "The events were temporary. The creative connections could travel into later releases.",
    date: "March–June 2022",
    year: 2022,
    type: "Gathering",
    title: "The internet needed somewhere to meet.",
    short: "From community rooms to Zoratopia",
    deck: "LATASHÁ’s community work around Zora connected online conversation with physical gatherings.",
    body: "LATASHÁ helped give an online scene a physical setting through Zoratopia. Austin’s March 2022 program billed Black Dave; June reporting from New York described three days of programming and performances by LATASHÁ and Iman Europe. The distinction between those gatherings matters, but their shared purpose is legible: hear the music, encounter its makers and spend time together away from a release page. The culture needed organizers as much as it needed software. Someone had to make a place where the online invitation could become a lived experience.",
    interpretation:
      "A gathering gives the music a place and a shared memory. That memory still needs someone to document it.",
    uncertainty:
      "Austin evidence is an announced lineup, not independent proof of attendance. Its page header has an invalid 1969 timestamp; the program itself specifies March 2022.",
    people: ["latasha", "black-dave-mk2", "iman-europe"],
    sources: ["zoratopia", "zoraJune", "onboarding"],
    related: ["sound", "network"],
    color: "blue",
    art: "gathering",
    artifact: "Explore the New York event report",
    artifactUrl: sources.zoraJune.url,
  },
  {
    id: "network",
    date: "2 December 2024",
    year: 2024,
    type: "Archive",
    title: "Someone had to keep the stories.",
    short: "The community becomes an archive",
    deck: "Network Archives brought many of these separate practices into one publication, curated and edited by Sound of Fractures.",
    body: "A scene leaves more behind than releases. Network Archives gathered creative practices and connections into a publication, with Jamie Reddington as curator and editor, C.Y. Lee as executive producer, Jade Garcia as producer and Ana Carolina as designer.\n\nDutchyyy, Black Dave MK2, Rae Isla, LATASHÁ, Xcelencia and Songcamp appear among its contributors. The book brings those different practices into a shared frame without requiring them to become one story. Preservation here is editorial work: deciding what to gather, how to credit it and how to make its connections available to someone who was not there.",
    interpretation:
      "The archive is another thing a community can make together—and a starting point for asking what is still missing.",
    people: networkNames.map(slug),
    sources: ["network", "networkReport"],
    related: ["scenes", "xcelencia", "rae", "dutch"],
    color: "mint",
    art: "archive",
    artifact: "Open Network Archives 001",
    artifactUrl: sources.network.url,
  },
  {
    id: "scenes",
    date: "12 June 2024",
    year: 2024,
    type: "Participatory album",
    title: "An album made room for your memories.",
    short: "SCENES",
    deck: "Sound of Fractures asked listeners to respond to songs with personal photographs and memories.",
    body: "Sound of Fractures invited listeners to bring their own memories into the world of an album. The resulting gallery made listening the beginning of a contribution: the music could call up something personal, and that response could become part of a shared setting. The project shifts the question from what a listener can own to what they can add. Its official release page holds the music beside the artist’s explanation of the experiment.",
    people: ["sound-of-fractures"],
    sources: ["scenes"],
    related: ["remix", "network"],
    color: "blue",
    art: "scenes",
    album: "2979209718",
    listenLabel: "SCENES · Sound of Fractures",
  },
  {
    id: "cc0lab",
    date: "2022 · before pack launch",
    year: 2022,
    type: "Offshoot",
    title: "One experiment sparked another.",
    short: "CHAOS branches into CC0lab",
    deck: "Songcamp’s retrospective describes a smaller group carrying the creative energy into CC0lab.",
    body: "After CHAOS, Songcamp tested what could happen when the materials of a project became available for others to reuse. Its retrospective describes 16 new songs, shared stems and a digital-fashion collaboration in CC0lab. The creative unit expanded again: recordings became ingredients, and music met another field of making. The experiment extended the camp’s interest in collaboration beyond the people who had first been assembled into a band.",
    people: ["songcamp"],
    sources: ["year"],
    related: ["chaos", "club-chaos"],
    color: "mint",
    art: "camp",
    artifact: "Read Songcamp’s CC0lab account",
    artifactUrl: sources.year.url,
  },
  {
    id: "common-pool",
    date: "After launch · recounted June 2023",
    year: 2023,
    type: "Collective decisions",
    title: "Sharing a project meant working through disagreement.",
    short: "Rights, value and a common pool",
    deck: "Songcamp’s retrospective describes tensions over allocation and the boundary between the core organization and the band.",
    body: "Making work together did not remove disagreement about how value should be shared. Songcamp’s retrospective describes some higher-compensated contributors returning value to a common pool. It also describes members taking their contributions into conventional distribution with their collaborators’ permission. The collective had to accommodate both a shared project and individual careers. Those decisions are part of the music’s history: the arrangements around a song influence whether its makers can keep working together.",
    uncertainty:
      "This is the organizer’s retrospective, not a complete set of participants’ accounts. Individual recollections and the final agreements have not been independently reconciled.",
    people: ["songcamp"],
    sources: ["year"],
    related: ["chaos", "splits", "club-chaos"],
    color: "mint",
    art: "camp",
    artifact: "Read the organizer account of the disagreements",
    artifactUrl: sources.year.url,
  },
  {
    id: "club-chaos",
    date: "12 April 2023",
    year: 2023,
    type: "Gathering",
    title: "The temporary band found a room.",
    short: "CLUB CHAOS at Public Records",
    deck: "Songcamp’s retrospective places CLUB CHAOS at Public Records during NFT NYC 2023.",
    body: "A temporary online band became a reason to gather again. Songcamp’s retrospective describes a two-night collaboration with Catalog and a collective decision to burn remaining unsold packs. Both actions changed the life of the release: one made a new setting for the music, while the other drew a boundary around its remaining supply. The camp’s original timetable had ended, but its participants still had decisions to make together.",
    people: ["songcamp"],
    sources: ["year"],
    related: ["chaos", "network"],
    color: "blue",
    art: "gathering",
    artifact: "Read the organizer retrospective",
    artifactUrl: sources.year.url,
  },
  {
    id: "splits",
    date: "2022–2023",
    year: 2022,
    type: "Infrastructure",
    title: "The people behind the payment rails.",
    short: "Songcamp and Splits",
    deck: "Shared authorship also needs a way to share proceeds.",
    body: "A collective release needs an answer to a plain question: when support comes in, where does it go? Splits’ account with Songcamp describes builders adapting payment infrastructure to the group’s needs. That work could be easy to overlook beside the finished songs, yet it helped make the collaboration practicable. Developers and economics contributors were part of the production around the music. Their work translated an agreement among people into a mechanism that could carry it out.",
    people: ["songcamp"],
    sources: ["splits"],
    related: ["chaos"],
    color: "mint",
    art: "camp",
    artifact: "Read the participant Q&A",
    artifactUrl: sources.splits.url,
  },
  {
    id: "mint-songs",
    date: "December 2021–February 2023",
    year: 2022,
    type: "Platform",
    title: "More than one way through the door.",
    short: "Mint Songs and open onboarding",
    deck: "Mint Songs offered a different route from Sound’s early curated artist network.",
    body: "Erin Ivey gave herself a deadline: mint a song before 2021 ended. On December 31, she released 50 editions through Mint Songs, choosing a recording from her first album that included her grandmother’s voice. Her guide records both the personal meaning and the friction: help from the platform, sync issues and waiting for the listing to appear.\n\nThis is what access looked like at the scale of one artist attempting a first release. Mint Songs offered an open route in; its later acquisition by Napster in 2023 shows how quickly the institutions around those experiments could change.",
    people: [],
    sources: ["erinMint", "onboarding", "mint"],
    related: ["sound", "zoratopia"],
    color: "pink",
    art: "mix",
    artifact: "Read the onboarding comparison",
    artifactUrl: sources.onboarding.url,
  },
  {
    id: "xcelencia",
    date: "April 2024",
    year: 2024,
    type: "Artist world",
    title: "An album that could keep growing.",
    short: "Xcelencia’s El Niño Estrella",
    deck: "Xcelencia described El Niño Estrella as his version of a limited digital box set.",
    body: "Xcelencia approached the album as something that could keep developing after release. His artist-authored 2024 account imagined a world with room for material beyond the recordings. That ambition extends the album’s relationship with its listeners: a release can mark the start of an exchange rather than the point at which the work is sealed. His earlier Sound recordings offer another way into that practice. Listen to the songs, then follow the larger question of how an independent artist might build a place around them.",
    people: ["xcelencia"],
    sources: ["xcelencia"],
    related: ["network", "scenes"],
    color: "pink",
    art: "xcelencia",
    artifact: "Read Xcelencia’s account (Spanish)",
    artifactUrl: sources.xcelencia.url,
  },
  {
    id: "rae",
    date: "Date not established",
    year: 9999,
    type: "Artist world",
    title: "A collection rooted in actual rocks.",
    short: "Rae Isla’s Rocks",
    deck: "Rae Isla’s own biography connects her music NFT collection to rocks from her real life.",
    body: "Rae Isla’s collection connects songs with actual rocks, bringing a physical object into the listener’s relationship with her music. The object gives the release a tactile point of entry into her world. Her account is one example of how widely artists interpreted the possibilities around a collectible: the encounter could extend beyond a file or an image on a screen. Her later contribution to Network Archives places that practice alongside other artists finding their own forms.",
    people: ["rae-isla"],
    sources: ["rae", "network"],
    related: ["network"],
    color: "blue",
    art: "rocks",
    artifact: "Read Rae Isla’s artist biography",
    artifactUrl: sources.rae.url,
  },
  {
    id: "dutch",
    date: "2023",
    year: 2023,
    type: "Release",
    title: "Follow the work, not just the token.",
    short: "Dutchyyy’s Thoughtful Jawn",
    deck: "Dutchyyy’s release notes preserve the path from a HEDSTAPE14 challenge to a release and a split with Harris Cole.",
    body: "Dutchyyy’s release page lets a listener follow the work through its musical, mastering and collecting credits. Each describes a different contribution to the recording’s life. A collector can help make support visible; the people who made and finished the music remain identifiable in their own roles. Reading those credits alongside listening restores detail that the broad label music NFT can hide. There is a particular recording here, with particular people around it.",
    people: ["dutchyyy", "harris-cole"],
    sources: ["dutch"],
    related: ["network", "remix"],
    color: "mint",
    art: "dutch",
    artifact: "Listen on Dutchyyy’s Bandcamp",
    artifactUrl: sources.dutch.url,
  },
];
export const chapter = guidedChapter;
export const relationships = [
  ...eraRelationships,
  {
    from: "sound-of-fractures",
    to: "three-oscillators",
    type: "Release / remix credit",
    moment: "remix",
    source: "remixes",
    note: "Three Oscillators remixed No One Knows Me Like You.",
  },
  {
    from: "three-oscillators",
    to: "boy-untitled",
    type: "Made a song together",
    moment: "walls",
    source: "walls",
    note: "Named participants in the Walls oral history.",
  },
  {
    from: "three-oscillators",
    to: "lackhoney",
    type: "Made a song together",
    moment: "walls",
    source: "walls",
    note: "Named participants in the Walls oral history.",
  },
  {
    from: "snoop-dogg",
    to: "black-dave-mk2",
    type: "Included in a mix",
    moment: "sound",
    source: "sound",
    note: "Contemporary reporting; not a claim of a shared studio session.",
  },
  {
    from: "snoop-dogg",
    to: "iman-europe",
    type: "Included in a mix",
    moment: "sound",
    source: "sound",
    note: "Contemporary reporting identifies Iman Europe in the release.",
  },
  {
    from: "latasha",
    to: "iman-europe",
    type: "Reported event performances",
    moment: "zoratopia",
    source: "zoraJune",
    note: "Named in the New York event report; this is an event connection.",
  },
  {
    from: "dutchyyy",
    to: "harris-cole",
    type: "Challenge / mastering / split",
    moment: "dutch",
    source: "dutch",
    note: "Roles described in Dutchyyy’s release notes.",
  },
  ...networkNames
    .filter((n) => n !== "Sound of Fractures")
    .map((name) => ({
      from: "sound-of-fractures",
      to: slug(name),
      type: "Publication credit",
      moment: "network",
      source: "network",
      note: "Curator/editor and contributor to Network Archives 001. No musical collaboration inferred.",
    })),
];

// Public person context: no inferred wallet ownership or social handles.
Object.assign(sources, {
  catalogSocials: {
    title: "Catalog founders on Mint — episode notes and profiles",
    by: "Adam Levy · Mint",
    date: "10 March 2022",
    kind: "Original interview episode notes",
    url: "https://podcasts.apple.com/us/podcast/heres-how-nfts-are-enabling-a-better-future-for/id1575762146?i=1000553625192",
    note: "Names Jeremy Stern and Mike McKain and explicitly links their Twitter profiles. Used for identity and social-link attribution.",
  },
  jameeSite: {
    title: "ART SCHOOL DROPOUT — Jamee Cornelia",
    by: "Jamee Cornelia",
    date: "Undated artist site; accessed 4 November 2026",
    kind: "Artist-owned site",
    url: "https://artschooldropout.carrd.co/",
    note: "Artist biography, music and social links. Distinct from independent verification of every collection linked there.",
  },
  sidneyProfile: {
    title: "Sidney Swift speaker profile",
    by: "Sidney Swift · Sessionize",
    date: "Undated; accessed 4 November 2026",
    kind: "Public professional profile",
    url: "https://sessionize.com/sidney-swift/",
    note: "Public biography links X, Instagram, LinkedIn and company site.",
  },
});
const personContext = [
  [
    "benjamin-james",
    "Benjamin James",
    ["musicben"],
    "Writer · STVDIO",
    "An artist and writer who documented music NFTs as musicben. His 2022 account connects his search for alternatives to an earlier label experience; his later STVDIO writing follows how music infrastructure changed.",
    ["musicben2022", "ben"],
    [
      ["X", "https://x.com/musicben_eth"],
      ["STVDIO", "https://stvdio.substack.com/"],
    ],
  ],
  [
    "jeremy-stern",
    "Jeremy Stern",
    [],
    "Co-founder · Catalog",
    "A Catalog co-founder whose background in music-making, DJing and online discovery informed Loft Radio and then a home for one-of-one digital records.",
    ["catalogOrigins", "catalogInterview", "catalogSocials"],
    [["X", "https://twitter.com/jzstern"]],
  ],
  [
    "mike-mckain",
    "Mike McKain",
    [],
    "Co-founder · Catalog",
    "Co-founded Loft Radio and Catalog with Jeremy Stern. Their interviews explain the path from artist tipping to collectible records that listeners could still hear freely.",
    ["catalogOrigins", "catalogInterview", "catalogSocials"],
    [["X", "https://twitter.com/mmckain_"]],
  ],
  [
    "imogen-heap",
    "Imogen Heap",
    [],
    "Artist · Tiny Human",
    "Worked with Ujo on the 2015 Tiny Human experiment connecting licensing, credits and payments. This earlier blockchain work is distinct from the later edition-NFT model.",
    ["ujoHistory"],
    [],
  ],
  [
    "rac",
    "RAC",
    [],
    "Artist · BOY / TAPE",
    "RAC’s BOY cassette release with Zora tested tokens redeemable for a physical object in May 2020, before the community explored the NFT formats followed here.",
    ["tape"],
    [],
  ],
  [
    "jacob-horne",
    "Jacob Horne",
    [],
    "Co-founder · Zora",
    "Explained the RAC cassette experiment in a contemporary builder account that documents its redemption mechanism.",
    ["tape"],
    [],
  ],
  [
    "jamee-cornelia",
    "Jamee Cornelia",
    [],
    "Artist · Future Surf Radio",
    "An experimental visual artist and alternative rapper. Future Surf’s schedule credits them as an Office Hours co-host alongside Cam Murdoch and Jazii, discussing practical rollout and marketing work.",
    ["futureSurf", "jameeSite"],
    [
      ["Artist site & socials", "https://artschooldropout.carrd.co/"],
      ["Bandcamp", "https://jameecornelia.bandcamp.com/"],
    ],
  ],
  [
    "jazii",
    "Jazii",
    [],
    "Artist · Future Surf Radio",
    "Credited as a co-host of Future Surf Radio’s artist-marketing discussions; the same newsletter points listeners toward their music.",
    ["futureSurf"],
    [],
  ],
  [
    "charm-taylor",
    "Charm Taylor",
    [],
    "Artist · For The People DAO",
    "Future Surf’s 2023 schedule names Charm Taylor and Diamond Doll hosting On3 for the People, a recurring live build and gathering across creative disciplines.",
    ["futureSurf"],
    [["X", "https://twitter.com/charmlikemagic"]],
  ],
  [
    "diamond-doll",
    "Diamond Doll",
    [],
    "Host · On3 for the People",
    "Named with Charm Taylor as host of a recurring live build of For The People DAO in Future Surf’s February 2023 schedule.",
    ["futureSurf"],
    [["X", "https://twitter.com/diamondoll_nft"]],
  ],
  [
    "scolla-fungwe",
    "Scolla Fungwe",
    [],
    "Host · Future Surf Radio",
    "Credited with Cam Murdoch and June Jissle as a host reviewing community music submissions on Future Surf Radio.",
    ["futureSurf"],
    [],
  ],
  [
    "june-jissle",
    "June Jissle",
    [],
    "Host · Future Surf Radio",
    "Credited as a co-host of Future Surf Radio’s twice-weekly music discovery show, listening to community submissions.",
    ["futureSurf"],
    [],
  ],
  [
    "dj-twinny-twin",
    "DJ Twinny Twin",
    [],
    "Host · Future Surf Tech Talk",
    "Named with Cam Murdoch as a host discussing technical tools and their applications for artists.",
    ["futureSurf"],
    [["Artist site", "https://twinnytwin.io/"]],
  ],
  [
    "sidney-swift",
    "Sidney Swift",
    [],
    "Producer · Defient / CHILL RX",
    "A music producer and Defient co-founder identified in the 2022 MUSEXPO program as the founder of CHILL RX. Distinct from Michael, who later operated the Chill Pill account.",
    ["chillFounder", "chillAccount", "sidneyProfile"],
    [
      ["X", "https://twitter.com/sidneyswift"],
      ["Profile & socials", "https://sessionize.com/sidney-swift/"],
    ],
  ],
  [
    "michael-escu",
    "Michael (Escu)",
    ["Michael (Escu)", "Escu"],
    "Community operator · Chill Pill",
    "Describes operating the Chill Pill account and hosting Spaces for the community around Cre8ors. His February 2024 post is an attributed retrospective, not a definitive account of every associated project.",
    ["chillAccount"],
    [
      [
        "Original X account and story",
        "https://x.com/ripchillpill/status/1754490183481761980",
      ],
    ],
  ],
  [
    "violetta-zironi",
    "Violetta Zironi",
    [],
    "Artist · Moonshot",
    "Her Moonshot collection combines songs, her father’s illustrations and continuing benefits offered to collectors. The artist’s page names the collaborators and explains redemption conditions.",
    ["moonshot"],
    [["Artist site", "https://violettazironi.com/"]],
  ],
  [
    "giuseppe-zironi",
    "Giuseppe Zironi",
    [],
    "Illustrator · Moonshot",
    "Violetta Zironi credits her father with the collection’s 2,500 hand-drawn artworks, connecting her musical release with his illustration practice.",
    ["moonshot"],
    [],
  ],
  [
    "michael-hunter-ochs",
    "Michael Hunter Ochs",
    [],
    "Songwriter · Moonshot",
    "Credited by Violetta Zironi as her writing collaborator on Moonshot’s five songs.",
    ["moonshot"],
    [],
  ],
  [
    "matt-rollings",
    "Matt Rollings",
    [],
    "Producer · Moonshot",
    "Credited as a co-producer on Violetta Zironi’s Moonshot songs.",
    ["moonshot"],
    [],
  ],
  [
    "aidan-cullen",
    "Aidan Cullen",
    [],
    "Creative lead · The Heart Project",
    "The April 2022 update identifies Cullen as a founder and the proposed album’s A&R and creative lead. This documents the planned process, not final album credits.",
    ["heartsApril"],
    [],
  ],
  [
    "d33j",
    "D33J",
    [],
    "Producer · proposed Hearts album",
    "Named among the team spearheading The Heart Project’s proposed community album in April 2022.",
    ["heartsApril"],
    [],
  ],
  [
    "tjani-warren",
    "Tjani Warren",
    [],
    "Proposed Hearts album team",
    "Named on the team leading the proposed community album process in The Heart Project’s April update.",
    ["heartsApril"],
    [],
  ],
  [
    "alex-valenti",
    "Alex Valenti",
    [],
    "Proposed Hearts album team",
    "Named on the team leading the proposed community album process in The Heart Project’s April update.",
    ["heartsApril"],
    [],
  ],
  [
    "prentiss",
    "Prentiss",
    [],
    "Artist · The Heart Project video",
    "The February 2022 update describes community involvement in a Prentiss music-video treatment and says the video was in post-production.",
    ["heartsFebruary"],
    [],
  ],
  [
    "benny-blanco",
    "Benny Blanco",
    [],
    "Artist · announced Hearts experiment",
    "The Heart Project announced a community beat-submission process involving Benny Blanco and Lil Dicky. Final release credits remain unverified here.",
    ["heartsFebruary"],
    [],
  ],
  [
    "lil-dicky",
    "Lil Dicky",
    [],
    "Artist · announced Hearts experiment",
    "Named in The Heart Project’s proposed community beat-submission experiment. The announcement is not presented as proof of a completed release.",
    ["heartsFebruary"],
    [],
  ],
  [
    "cooper-turley",
    "Cooper Turley",
    [],
    "Founder · Coop Records",
    "Describes helping artists release onchain without doing all the technical work themselves, and later building new distribution and discovery tools through Coop Records.",
    ["coopInterview", "coopLater"],
    [["Founder’s writing", "https://paragraph.com/@coopahtroopa.eth"]],
  ],
  [
    "oshi",
    "OSHI",
    [],
    "Artist · Catalog / Sound",
    "Appears among Catalog’s early releases; Sound’s anniversary account names CHILDHOOD as its first drop.",
    ["catalogInterview", "soundYear"],
    [],
  ],
  [
    "laxcity",
    "Laxcity",
    [],
    "Artist · early Catalog releases",
    "One of the artists whose recordings are linked in Catalog’s April 2021 founder interview.",
    ["catalogInterview"],
    [],
  ],
  [
    "salva",
    "SALVA",
    [],
    "Artist · early Catalog releases",
    "One of the artists whose recordings are linked in Catalog’s April 2021 founder interview.",
    ["catalogInterview"],
    [],
  ],
  [
    "richie-hawtin",
    "Richie Hawtin",
    [],
    "Artist · early Catalog releases",
    "Named among the early Catalog artists in the contemporary founder interview.",
    ["catalogInterview"],
    [],
  ],
  [
    "boys-noize",
    "Boys Noize",
    [],
    "Artist · early Catalog releases",
    "Named among the early Catalog artists in the contemporary founder interview.",
    ["catalogInterview"],
    [],
  ],
  [
    "austin-robey",
    "Austin Robey",
    [],
    "Interviewer · Walls oral history",
    "Published the participant interview that follows Boy Untitled, Lackhoney and Three Oscillators through the making of Walls.",
    ["walls"],
    [],
  ],
  [
    "marvin-lin",
    "Marvin Lin",
    [],
    "Interviewer · CHAOS launch",
    "Interviewed Matthew Chaim, Mark Redito and Greydient about the collective’s creative and organizational experiment.",
    ["chaosLaunch"],
    [],
  ],
  [
    "adam-levy",
    "Adam Levy",
    [],
    "Interviewer · Mint",
    "Hosted the March 2022 Catalog founder conversation, documenting the project’s approach and its founders’ public profiles.",
    ["catalogSocials"],
    [
      ["X", "https://twitter.com/levychain"],
      ["Website", "https://adamlevy.io"],
    ],
  ],
  [
    "fede-petro",
    "Fede Petro",
    [],
    "Photographer · Rae Isla performance portrait",
    "Credited for the Rae Isla performance image used in this documentary. The portrait does not establish attendance at a particular NFT-era event.",
    ["rae"],
    [],
  ],
];
for (const [id, name, aliases, role, bio, refs, links] of personContext) {
  let person = people.find((p) => p.id === id);
  if (!person) {
    person = { id, name, groups: [], sources: [] };
    people.push(person);
  }
  Object.assign(person, {
    name,
    aliases,
    role,
    bio,
    links: links.map(([label, url]) => ({ label, url })),
  });
  person.sources = [...new Set([...person.sources, ...refs])];
}
const knownAliases = {
  tk: ["TK the Legend"],
  "black-dave-mk2": ["Black Dave"],
  mdcl: ["Mark de Clive-Lowe"],
  latasha: ["LATASHA"],
  verite: ["VÉRITÉ", "Vérité"],
  heno: ["Heno."],
  lackhoney: ["Aly"],
  "l-ariel": ["L. Ariel", "L.Ariel"],
};
for (const [id, aliases] of Object.entries(knownAliases)) {
  const person = people.find((p) => p.id === id);
  if (person)
    person.aliases = [...new Set([...(person.aliases || []), ...aliases])];
}
const aliasesByRecordId = {
  "tk-the-legend": "tk",
  "mark-de-clive-lowe": "mdcl",
};
const canonical = (name) =>
  people.find((p) =>
    [p.name, ...(p.aliases || [])].some(
      (n) => n.toLowerCase() === name.toLowerCase(),
    ),
  );
// Token artist fields are credits, not biography or identity/wallet proof.
for (const record of nftCatalog) {
  const sid = `credit-${record.id}`;
  sources[sid] = {
    title: `${record.title} — original edition`,
    by: record.artist,
    date: `Metadata checked ${record.checkedAt}`,
    kind: "Original NFT credit",
    url:
      record.originalRelease ||
      `https://${{ 1: "etherscan.io", 10: "optimistic.etherscan.io", 8453: "basescan.org", 7777777: "explorer.zora.energy" }[record.chainId]}/token/${record.contract}?a=${record.tokenId}`,
    note:
      record.note +
      " Artist names follow this edition’s metadata. No wallet-control or personal relationship inference.",
  };
  const names = record.artist.split(/\s*[·,&]\s*/).filter(Boolean);
  record.personIds = [];
  for (const name of names) {
    let person = canonical(name);
    if (!person) {
      const id =
        names.length === 1 && record.artistId !== "songcamp"
          ? aliasesByRecordId[record.artistId] || record.artistId || slug(name)
          : slug(name);
      person = people.find((p) => p.id === id);
      if (!person) {
        person = {
          id,
          name,
          role: "Artist · recording credit",
          groups: [],
          sources: [],
        };
        people.push(person);
      }
    }
    person.sources = [...new Set([...person.sources, sid])];
    person.recordIds = [...new Set([...(person.recordIds || []), record.id])];
    record.personIds.push(person.id);
    person.bio ||= `Credited on ${record.title}. ${record.note} Follow the original edition and recording below to hear this part of their work.`;
  }
}
const profileUpdates = {
  tk: [
    "Artist · Eternal Garden",
    "TK describes Eternal Garden as an album and a world that could keep unfolding through music, artwork and community participation. His interview also discusses the daily work of maintaining that relationship.",
    "tkGarden",
  ],
  "cam-murdoch": [
    "Artist and host · Future Surf Radio",
    "Future Surf’s schedule connects Cam Murdoch to music-submission shows, artist-marketing discussions and technical conversations. That recurring work helped create places for artists to learn from one another.",
    "futureSurf",
  ],
  "black-dave-mk2": [
    "Artist · music, video and participation experiments",
    "Black Dave’s account connects a wavWRLD performance, a Glass video release and a proposed way to share its proceeds with existing collectors. His work asks what participation can offer beyond another purchase.",
    "blackDaveGlass",
  ],
};
for (const [id, [role, bio, source]] of Object.entries(profileUpdates)) {
  const p = people.find((p) => p.id === id);
  Object.assign(p, { role, bio });
  p.sources = [...new Set([...p.sources, source])];
}
for (const person of people)
  person.bio ||= person.sources.includes("network")
    ? "Credited in Network Archives 001, a publication gathering creative work and perspectives from this community. This publication credit is a starting point for exploration; it does not imply a musical collaboration with everyone in the archive."
    : `${person.role}. The accounts below document their part in this chapter.`;

// Additional named contributors in the selected editions' explicit titles/notes.
for (const [name, titlePart, role] of [
  ["Scott Quinn", "No One Knows Me Like You", "Featured artist"],
  ["VÉRITÉ", "WATÉR", "Musician"],
  ["Tarot", "MIAMI FREESTYLE", "Performer"],
  ["Elle Symone", "MIAMI FREESTYLE", "Performer"],
  ["Early", "MIAMI FREESTYLE", "Performer"],
  ["Tipz", "Different World", "Producer"],
  ["Pat Dimitri", "Different World", "Guitarist"],
  ["Reo Cragun", "EMPIRE", "Featured artist"],
  ["Icona Pop", "EMPIRE", "Featured artists"],
  ["Clear eyes", "BULLS ON PARADE", "Credited artist"],
  ["Pat Junior", "Need That", "Artist"],
  ["Sammy Arriaga", "Heartbreak Closer", "Performer"],
  ["Radamiz", "Ol' BK Soul", "Featured artist"],
  ["Tulengua", "dias prometidos", "Credited artist"],
  ["Paula Pazos", "dias prometidos", "Credited artist"],
]) {
  const record = nftCatalog.find((r) => r.title.includes(titlePart));
  if (!record) continue;
  const person = canonical(name) || {
    id: slug(name),
    name,
    groups: [],
    sources: [],
    recordIds: [],
  };
  if (!people.includes(person)) people.push(person);
  person.role = `${role} · ${record.title}`;
  person.bio = `${role} named in the credits of ${record.title}. ${record.note}`;
  person.sources = [...new Set([...person.sources, `credit-${record.id}`])];
  person.recordIds = [...new Set([...(person.recordIds || []), record.id])];
  record.personIds = [...new Set([...record.personIds, person.id])];
}
relationships.push({
  from: "jeremy-stern",
  to: "mike-mckain",
  type: "Co-founders · Catalog",
  moment: "catalog",
  source: "catalogOrigins",
  note: "Jeremy Stern and Mike McKain describe building Loft Radio and Catalog together in their founder interview.",
});

for (const [name, role, source] of [
  ["Erin Ivey", "Artist · documented Mint Songs onboarding", "erinMint"],
  ["Russell Matthews", "Songcamp contributor · Splits interview", "splits"],
  ["David Greenstein", "Sound co-founder · closing announcement", "soundEnd"],
  ["Langston Thomas", "Reporter · Zoratopia", "zoraJune"],
  ["Jex Exmundo", "Reporter · Zoratopia", "zoraJune"],
]) {
  if (!canonical(name))
    people.push({
      id: slug(name),
      name,
      role,
      bio: `${role}. Their linked account is part of the evidence used to tell this history.`,
      sources: [source],
      groups: [],
    });
}

people.find((p) => p.id === "imogen-heap").sources.push("heapMycelia");

// Period-specific context shares the accessible drawer; these are not artist identities.
for (const entry of [
  {
    id: "zora",
    name: "Zora",
    kind: "Platform",
    role: "Creator markets, shared infrastructure and gathering places · 2020–22",
    bio: "Zora built tools for creators to release and sell work as tokens. In May 2020, RAC used it for tokens redeemable for BOY cassettes. That was a physical-release experiment, not a unique music NFT.\n\nBy 2021, Catalog’s founders described using Zora’s shared infrastructure for one-of-one audio records: a record could be encountered beyond a single storefront.\n\nAnother part of the story was social. LATASHÁ-led Zoratopia events brought artists and listeners together in person in 2022. The marketplace, the underlying tools and those gatherings played different roles; Zora here refers to this period, not a description of its present product.",
    sources: ["tape", "catalogInterview", "zoraJune"],
    moments: ["tape", "catalog", "zoratopia"],
  },
  {
    id: "catalog-platform",
    name: "Catalog",
    aliases: ["Catalog.xyz"],
    kind: "Platform",
    role: "One-of-one digital records · launched March 2021",
    bio: "Jeremy Stern and Mike McKain built Catalog around a distinction: everyone could listen, while someone could collect a one-of-one record. The founders came from music, DJing and their earlier tipping project, Loft Radio. Catalog used Zora infrastructure and became a meeting point for musicians exploring direct support. Its closing announcement is also part of this history: a token and its media can outlive the interface that introduced them, but preservation still needs care.",
    sources: ["catalogOrigins", "catalogInterview", "catalogFin"],
    moments: ["catalog"],
  },
  {
    id: "loft-radio",
    name: "Loft Radio",
    kind: "Project",
    role: "The listening-and-tipping experiment before Catalog",
    bio: "Jeremy Stern and Mike McKain describe building Loft Radio before Catalog. It let listeners tip artists. That earlier attempt to connect listening with direct support helps explain why they later explored collectible records.",
    sources: ["catalogOrigins"],
    moments: ["catalog"],
  },
  {
    id: "sound-platform",
    name: "Sound.xyz",
    aliases: ["Sound"],
    kind: "Platform",
    role: "Collectible song editions and shared listening · 2021–26",
    bio: "Sound helped musicians release collectible editions of songs. Its first drop was OSHI’s CHILDHOOD in November 2021. Editions let more than one listener collect the same release, unlike Catalog’s one-of-one model. In September 2022, Sound introduced permissionless contracts while its own website still selected participating artists; website uploads opened to all in July 2023. The team later announced the website’s January 2026 closure. This history separates the listening site from the contracts and media underneath it.",
    sources: ["soundYear", "soundProtocol", "soundOpen", "soundEnd"],
    moments: ["sound-genesis"],
  },
  {
    id: "glass-platform",
    name: "Glass",
    aliases: ["glass.xyz"],
    kind: "Platform",
    role: "Video as a collectible artifact",
    bio: "Glass applied token-based publishing to video, including music videos and filmed performances. That matters here because the scene left moving-image artifacts as well as songs. Black Dave’s account of a wavWRLD performance filmed by Glass shows an artist experimenting with who shared in a release’s proceeds. A surviving video or token does not, by itself, prove that today’s publishing service still works.",
    sources: ["glassHome", "glassMetadata"],
    moments: ["glass", "black-dave-glass"],
  },
  {
    id: "mycelia",
    name: "Mycelia",
    kind: "Project",
    role: "Imogen Heap’s vision for music, credits and permissions",
    bio: "Imogen Heap imagined songs carrying the information about their creation: who contributed, how the work could be used and how people should be paid. Mycelia was that broader vision. Tiny Human gave Heap and Ujo a concrete song with which to test part of it. This was an earlier music-and-blockchain experiment, not an edition NFT launch.",
    sources: ["heapMycelia", "ujoHistory"],
    moments: ["tiny-human"],
  },
  {
    id: "ujo",
    name: "Ujo",
    aliases: ["Ujo Music"],
    kind: "Project",
    role: "Testing licensing and automated contributor payments",
    bio: "Ujo worked on the Ethereum-based Tiny Human prototype with Imogen Heap in 2015. The experiment connected licensing terms with automatic payments to contributors. The team’s 2016 retrospective explains why it closed the prototype: maintaining it was taking resources from its next platform. It demonstrated a possible mechanism, not a solved music industry.",
    sources: ["ujoHistory", "heapMycelia"],
    moments: ["tiny-human"],
  },
  {
    id: "zoratopia-context",
    name: "Zoratopia",
    kind: "Gathering",
    role: "LATASHÁ-led meeting places for the scene · 2022",
    bio: "Zoratopia brought the online community into physical venues through music and artist-led programming. Austin’s March 2022 listing billed Black Dave; June reporting from New York describes performances by LATASHÁ and Iman Europe. These records describe distinct events. A program establishes who was billed, not proof that every named person attended.",
    sources: ["zoratopia", "zoraJune"],
    moments: ["zoratopia"],
  },
]) {
  people.push({ ...entry, groups: [] });
}

// Explicit contributor credit from the original token metadata, re-read November 4.
const miamiFreestyle = nftCatalog.find((r) => r.id === "record-69c77ef0");
miamiFreestyle.personIds = [
  ...new Set([...miamiFreestyle.personIds, "pete-rango"]),
];
miamiFreestyle.note =
  "CAMPFIRE’s genesis release came from its Art Basel artist camp in Miami. Produced by AbJo; mixed and mastered by Pete Rango; artwork by Karey and TK. Original release notes describe CAMPFIRE S1 as songs voted on by its community.";
const peteContext = people.find((p) => p.id === "pete-rango");
peteContext.sources = [
  ...new Set([...peteContext.sources, "credit-record-69c77ef0"]),
];
const not4me = nftCatalog.find((r) => r.id === "record-not4me");
if (not4me) {
  not4me.personIds = [...new Set([...not4me.personIds, "pete-rango"])];
  peteContext.sources.push("credit-record-not4me");
}
Object.assign(sources, {
  campfireYell: {
    title: "Yell & Scream: CAMPFIRE release announcement",
    by: "CAMPFIRE",
    date: "11 July 2023",
    kind: "Original project post",
    url: "https://x.com/Campfire_xyz/status/1678835225378553856",
    note: "Names the performers and credits Pete Rango as co-producer. Original Sound link is sound.xyz/campfire/yell-and-scream. Contract and original media have not yet been resolved into this prototype; this source does not establish playback availability.",
  },
  campfireMoving: {
    title: "Moving On: CAMPFIRE release post",
    by: "CAMPFIRE",
    date: "9 August 2023",
    kind: "Original project post",
    url: "https://x.com/Campfire_xyz/status/1689402208620838913",
    note: "Links the project's Moving On release on Sound. The token and original media remain to be resolved; no playable record is claimed here.",
  },
});
peteContext.sources.push("campfireYell");
peteContext.bio =
  "Pete Rango is a musician, producer and Music Nerd builder. The original MIAMI FREESTYLE metadata credits him with mixing and mastering; AL3C’s NOT4ME credits him as co-producer. CAMPFIRE’s July 2023 announcement also credits him as co-producer of Yell & Scream. These documented roles connect him to the work below; this selection is not his complete discography.";
const campfireContext = people.find((p) => p.id === "campfire");
Object.assign(campfireContext, {
  kind: "Collective",
  role: "Collaborative artist camps and community-selected releases",
  bio: "CAMPFIRE’s MIAMI FREESTYLE release notes describe an Art Basel camp in Miami with more than 50 artists collaborating. The project describes its S1 releases as songs selected by community vote. Its own 2023 posts also document Yell & Scream and Moving On. Only Miami Freestyle is currently playable in this selection; the other releases are documented below while their original media is being recovered.",
  sources: [...campfireContext.sources, "campfireYell", "campfireMoving"],
});

miamiFreestyle.credits = [
  { personId: "pete-rango", role: "Mixing & mastering" },
];
not4me.credits = [
  { personId: "al3c", role: "Writing, performance & co-production" },
  { personId: "pete-rango", role: "Co-production" },
];

peteContext.role = "Musician, producer & Music Nerd builder";

// A scheduled role is sufficient to identify the people discussed in this chapter.
// Attendance and uncredited collaborations remain unclaimed in its evidence notes.
const futureSurfChapter = moments.find((m) => m.id === "future-surf");
futureSurfChapter.people = [
  "cam-murdoch",
  "jazii",
  "jamee-cornelia",
  "charm-taylor",
  "diamond-doll",
];

sources.erinProfile = {
  title: "Erin Ivey — official biography and press photos",
  by: "Erin Ivey",
  date: "Accessed November 4, 2026",
  kind: "Artist biography",
  url: "https://erinivey.com/pages/bio",
  note: "The artist’s biography identifies her as an Austin singer-songwriter and names participation in the first international Mashibeats Web3 Creator Club cohort. Its HI RES PHOTOS section supplies the portrait used here; photo credit Nicola Gell.",
};
const erinProfile = people.find((p) => p.id === "erin-ivey");
if (erinProfile) {
  erinProfile.bio =
    "Erin Ivey is an Austin singer-songwriter. Her account of minting a song on the last day of 2021 turns an unfamiliar process into something another artist could try: a recording carrying her grandmother’s voice, a self-imposed deadline, help from other people and the friction of getting it listed. Her official biography also names participation in the first international Mashibeats Web3 Creator Club cohort.";
  erinProfile.sources = [...new Set([...erinProfile.sources, "erinProfile"])];
  erinProfile.links = [
    ...(erinProfile.links || []),
    { label: "Official artist site", url: "https://erinivey.com/pages/bio" },
  ];
}

// The filmed account adds motivation to the event record, without inventing a venue or date.
const zoraGathering = moments.find((m) => m.id === "zoratopia");
zoraGathering.body =
  "LATASHÁ’s organizing answered a problem she recognized. In Minted, she recalls having a performance stopped and finding familiar exclusions inside NFT events. New release tools had not automatically changed who felt welcome. She began helping artists understand minting and the available platforms; gathering people and sharing knowledge became part of her practice.\n\nZoratopia gave that work a physical setting. Austin’s March 2022 program billed Black Dave; June reporting from New York describes three days of programming with LATASHÁ and Iman Europe. The scene needed more than a place to transact. It needed people willing to teach, host and make room for the music. Those responsibilities were part of what the community was building.";
zoraGathering.sources.push("minted", "latashaJah");
zoraGathering.related.push("latasha-videos");

// Additional context recovered alongside the recordings, not inferred from holdings.
sources.jameeDropout = {
  title: "Being a dropout hasn't been this cool since '04",
  by: "Future Surf Radio",
  date: "2023 · Art School Dropout release coverage",
  kind: "Community publication",
  url: "https://paragraph.com/@futuresurf/art-school-dropout",
  note: "Documents the album, artist-made visuals, advance access and cassette copies for previous NFT holders, and Jamee’s role at Glass. The old Sound playlist is no longer reachable; it is not evidence that the complete album has been recovered here.",
};
const jameeProfile = people.find((p) => p.id === "jamee-cornelia");
jameeProfile.role = "Rapper, visual artist and filmmaker";
jameeProfile.bio =
  "Jamee Cornelia brought music, visual art and filmmaking into the same practice. Their Sound release real shit tho describes an alternative rapper shaped by punk, pop and hip-hop; it credits production to Kanpekibeats. For Art School Dropout, Future Surf reported that previous NFT holders received early digital access and cassette copies. Jamee also made the album’s visuals and music videos and worked as Glass’s Head of Community.\n\nTheir recovered recordings include SKYZONE with Jon Waltz and Jadyn Violet, and a filmed performance of Dizzy at Zoratopia Miami in December 2022. The film’s original credits include Jahmel Reynolds (Jah). These works give another route into their story alongside the Future Surf Radio sessions they co-hosted.";
jameeProfile.sources.push("jameeDropout");
for (const record of nftCatalog.filter(
  (r) => /Zoratopia Miami/.test(r.title) && /Jahmel Reynolds/.test(r.note),
)) {
  const p = people.find((p) => p.id === "jah");
  record.personIds = [...new Set([...record.personIds, "jah"])];
  p.recordIds = [...new Set([...(p.recordIds || []), record.id])];
  p.sources = [...new Set([...p.sources, `credit-${record.id}`])];
}
