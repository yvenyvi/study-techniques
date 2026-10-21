import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  copyFile,
  writeFile,
  rm,
} from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

export async function prepareDesktopRelease({
  bundleDir,
  outputDir,
  version,
  notes,
  repository = "yvenyvi/study-techniques",
  requireSignature = false,
}) {
  if (!/^\d+\.\d+\.\d+$/.test(version))
    throw Error("A stable semantic release version is required.");
  const candidates = (await readdir(bundleDir)).filter((name) =>
    name.endsWith("-setup.exe"),
  );
  if (candidates.length !== 1)
    throw Error("Expected exactly one Windows installer.");
  const source = join(bundleDir, candidates[0]);
  const installerName = "Study-Room-Windows-x64-Setup.exe";
  const bytes = await readFile(source);
  let signature;
  try {
    signature = (await readFile(`${source}.sig`, "utf8")).trim();
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (requireSignature && !signature)
    throw Error(
      "Refusing to publish an unsigned update. Configure Actions signing secrets first.",
    );
  if (
    signature &&
    !Buffer.from(signature, "base64")
      .toString()
      .startsWith("untrusted comment:")
  )
    throw Error("Invalid Tauri signature format.");
  await mkdir(outputDir, { recursive: true });
  // Never leave an old feed or signature attached to a newly unsigned build.
  await rm(join(outputDir, "latest.json"), { force: true });
  await rm(join(outputDir, `${installerName}.sig`), { force: true });
  await copyFile(source, join(outputDir, installerName));
  await writeFile(
    join(outputDir, "SHA256SUMS.txt"),
    `${createHash("sha256").update(bytes).digest("hex")}  ${installerName}\n`,
  );
  if (signature) {
    await writeFile(join(outputDir, `${installerName}.sig`), signature + "\n");
    const manifest = {
      version,
      notes,
      pub_date: new Date().toISOString(),
      platforms: {
        "windows-x86_64": {
          signature,
          url: `https://github.com/${repository}/releases/download/desktop-v${version}/${installerName}`,
        },
      },
    };
    await writeFile(
      join(outputDir, "latest.json"),
      JSON.stringify(manifest, null, 2) + "\n",
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const config = JSON.parse(
    await readFile("src-tauri/tauri.conf.json", "utf8"),
  );
  await prepareDesktopRelease({
    bundleDir: "src-tauri/target/release/bundle/nsis",
    outputDir: "release",
    version: config.version,
    notes: await readFile("docs/DESKTOP_RELEASE.md", "utf8"),
    requireSignature: process.env.STUDY_ROOM_REQUIRE_UPDATER === "1",
  });
}
