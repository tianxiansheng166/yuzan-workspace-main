/**
 * Load and lightly validate MIG-001 outputs.
 */

const { readFile } = require("node:fs/promises");
const { resolve } = require("node:path");

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

  const courses = await loadJson(
    resolve(root, "legacy/exports/mig-001-courses.json"),
  );
  const translations = await loadJson(
    resolve(root, "legacy/exports/mig-001-translations.json"),
  );
  const media = await loadJson(
    resolve(root, "legacy/exports/mig-001-media.json"),
  );
  const classification = await loadJson(
    resolve(root, "legacy/review/mig-001-classification.json"),
  );

  return { courses, translations, media, classification };
}

/**
 * @param {string} filePath
 * @returns {Promise<object>}
 */
async function loadJson(filePath) {
  const text = await readFile(filePath, "utf8");
  return JSON.parse(text);
}

module.exports = { loadMig001Inputs, loadJson };
