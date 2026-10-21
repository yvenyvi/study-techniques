import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { unzipSync, strFromU8 } from "fflate";
import { describe, it, expect } from "vitest";
import { validateBackup } from "./backup";

describe("web / iPad backup compatibility", () => {
  for (const name of ["web-v1", "native-v1"])
    it(`accepts ${name} with linked study content`, () => {
      const archive = unzipSync(
        readFileSync(`mobile/test/fixtures/${name}.zip`),
      );
      const data = JSON.parse(strFromU8(archive["manifest.json"]));
      expect(() => validateBackup(data, archive)).not.toThrow();
      expect(
        data.notes[0].content.content[2].content[0].marks[0].attrs.href,
      ).toBe("/study/doc-memory?page=1");
      expect(data.reviewers[0].sections[0].refs[0].page).toBe(1);
      expect(data.goals[0].done).toBe(false);
      expect(strFromU8(archive["pdfs/doc-memory.pdf"])).toContain("%PDF-1.4");
    });
});
