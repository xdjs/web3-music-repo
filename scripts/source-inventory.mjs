import { writeFile } from "node:fs/promises";
import { sources, moments, people, relationships } from "../src/data.js";
const escape = (s) => s.replaceAll("|", "\\|");
const rows = Object.entries(sources)
  .map(
    ([id, s]) =>
      `| ${id} | [${escape(s.title)}](${s.url}) | ${s.by} | ${s.date} | ${s.kind} | ${s.note} |`,
  )
  .join("\n");
await writeFile(
  new URL("../docs/SOURCES.md", import.meta.url),
  `# Source inventory\n\nResearch access date: November 3, 2026. Historical publication dates are separately recorded below. Copy is authored paraphrase, not invented quotation. Participant interviews and organizer retrospectives retain attribution; editorial interpretation is labeled in the interface. No private Lore or meeting transcript is distributed.\n\n| ID | Original source | Attribution | Relevant date | Evidence type | Support and limitation |\n| --- | --- | --- | --- | --- | --- |\n${rows}\n\n## Moment mapping\n\n| Moment | Event date | Sources |\n| --- | --- | --- |\n${moments.map((m) => `| ${m.short} | ${m.date} | ${m.sources.join(", ")} |`).join("\n")}\n\n## Structured model\n\nThe reviewed fixture lives in [src/data.js](../src/data.js): ${moments.length} moments, ${people.length} named people/credited contributors, ${relationships.length} typed edges. People retain source IDs, roles and confirmed references where available. Moments retain date precision, artifact links and uncertainty. Relationships carry a specific type, supporting source and originating moment. Sources carry the original URL, attribution, date and supporting passage summary. This module is a public, deliberately limited projection, not an export of Music Nerd data.\n\nNetwork Archives is a publication relationship; its credits do not imply pairwise musical collaboration. The complete CHAOS roster is not recovered.\n`,
);
