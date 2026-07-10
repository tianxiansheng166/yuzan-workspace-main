/**
 * Load and lightly validate MIG-001 outputs.
 */

const { resolve } = require("node:path");
const { safeReadJsonFile } = require("./path-guard.js");

/**
 * @typedef {object} Mig001Inputs
 * @property {object} courses
 * @property {object} translations
 * @property {object} media
 * @property {object} classification
 */

/**
 * @param {string} baseDir
 * @returns {Promise<Mig001Inputs>}
 */
async function loadMig001Inputs(baseDir) {
  const root = resolve(baseDir);

  const courses = await safeReadJsonFile(
    resolve(root, "legacy/exports/mig-001-courses.json"),
    root,
  );
  const translations = await safeReadJsonFile(
    resolve(root, "legacy/exports/mig-001-translations.json"),
    root,
  );
  const media = await safeReadJsonFile(
    resolve(root, "legacy/exports/mig-001-media.json"),
    root,
  );
  const classification = await safeReadJsonFile(
    resolve(root, "legacy/review/mig-001-classification.json"),
    root,
  );

  return { courses, translations, media, classification };
}

module.exports = { loadMig001Inputs };
