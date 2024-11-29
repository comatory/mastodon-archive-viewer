import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * @typedef {Object} Attachment
 * @property {string} url
 *
 * @typedef {Object} StatusObject
 * @property {Array<Attachment>} attachment
 *
 * @typedef {Object} Status
 * @property {StatusObject | undefined} object
 *
 * @typedef {Object} OutboxJson
 * @property {Array<Status> | undefined} orderedItems
 */

let changeCounter = 0;
/** @type {Array<string>} */
const logs = [];

/**
 * Normalize the path of the attachment URL
 *
 * @param {string} path
 */
function normalizePath(path) {
  if (path.startsWith("/media_attachments")) {
    console.warn(`Path ${path} is already normalized. Skipping normalization.`);
    return path;
  }

  changeCounter++;

  const segments = path.split("/");
  // Remove the first non-empty segment (index 1, as index 0 is empty due to leading slash)
  segments.splice(1, 1);

  // Join the remaining segments back into a path
  const newPath = segments.join("/");

  logs.push(`${path} -> ${newPath}`);

  return newPath;
}

const OUTBOX_PATH = join(process.cwd(), "archive-data", "outbox.json");

async function main() {
  const file = await readFile(OUTBOX_PATH, "utf-8");

  /** @type {OutboxJson} */
  const json = JSON.parse(file);

  if (!json.orderedItems) {
    throw new Error("Invalid JSON format");
  }

  const output = json.orderedItems.reduce(
    /**
     * @param {Array<Status>} acc
     * @param {Status} status
     * @returns {Array<Status>}
     */
    (acc, status) => {
      if (!status.object?.attachment) {
        return acc;
      }

      const attachments = status.object.attachment.map((attachment) => ({
        ...attachment,
        ...("url" in attachment ? { url: normalizePath(attachment.url) } : {}),
      }));

      return [
        ...acc,
        {
          ...status,
          object: {
            ...status.object,
            attachment: attachments,
          },
        },
      ];
    },
    [],
  );

  await writeFile(
    OUTBOX_PATH,
    JSON.stringify({ ...json, orderedItems: output }),
  );

  for (const log of logs) {
    console.info(log);
  }

  console.info(`Normalized ${changeCounter} attachment URLs`);
}

void main();
