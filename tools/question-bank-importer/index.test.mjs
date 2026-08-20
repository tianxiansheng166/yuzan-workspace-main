import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
test("importer includes strict fail-closed guards",async()=>{const source=await readFile(new URL("./index.mjs",import.meta.url),"utf8");for(const token of ["IMAGE_AMBIGUOUS","MEDIA_MISSING","QUESTION_COUNT_MISMATCH","DELIVERY_SCORING_LEAK"])assert.match(source,new RegExp(token))});
