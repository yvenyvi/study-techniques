import { mkdirSync, writeFileSync } from "node:fs";
import { zipSync, strToU8 } from "fflate";
// A version-1 web export fixture. Keep this schema aligned with src/backup.ts.
const content =
  "BT /F1 18 Tf 50 720 Td (Working memory supports learning.) Tj ET";
const objects = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
];
let pdf = "%PDF-1.4\n";
const offsets = [];
objects.forEach((o, i) => {
  offsets.push(Buffer.byteLength(pdf));
  pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
});
const xref = Buffer.byteLength(pdf);
pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.map((n) => `${String(n).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
const manifest = {
  version: 1,
  courses: [
    {
      id: "course-memory",
      name: "Cognitive Psychology",
      description: "Memory and thinking",
      color: "#688975",
    },
  ],
  documents: [
    {
      id: "doc-memory",
      title: "Memory",
      courseId: "course-memory",
      tags: "memory",
      hash: "fixture",
      pages: 1,
      page: 1,
      created: 0,
    },
  ],
  notes: [
    {
      id: "note-memory",
      title: "Working memory notes",
      courseId: "course-memory",
      documentId: "doc-memory",
      updated: 0,
      content: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Working memory" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Holding information for active use.",
                marks: [{ type: "bold" }],
              },
            ],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Memory · page 1",
                marks: [
                  { type: "link", attrs: { href: "/study/doc-memory?page=1" } },
                ],
              },
            ],
          },
        ],
      },
    },
  ],
  reviewers: [
    {
      id: "reviewer-memory",
      title: "Memory reviewer",
      courseId: "course-memory",
      tags: "memory",
      updated: 0,
      sections: [
        {
          id: "section-memory",
          kind: "Practice questions",
          fields: {
            Question: "What does working memory do?",
            Answer: "Holds information for active use.",
          },
          refs: [
            {
              documentId: "doc-memory",
              page: 1,
              quote: "Working memory supports learning.",
            },
          ],
        },
      ],
    },
  ],
  goals: [
    {
      id: "goal-memory",
      title: "Explain working memory",
      criterion: "Finish my concept explanation",
      courseId: "course-memory",
      materialIds: ["doc-memory", "reviewer:reviewer-memory"],
      done: false,
      created: 0,
    },
  ],
  sessions: [],
  settings: [
    { id: "preferences", value: { focus: 25, rest: 5, sound: false } },
  ],
};
mkdirSync("mobile/test/fixtures", { recursive: true });
writeFileSync(
  "mobile/test/fixtures/web-v1.zip",
  zipSync({
    "manifest.json": strToU8(JSON.stringify(manifest)),
    "pdfs/doc-memory.pdf": strToU8(pdf),
  }),
);
