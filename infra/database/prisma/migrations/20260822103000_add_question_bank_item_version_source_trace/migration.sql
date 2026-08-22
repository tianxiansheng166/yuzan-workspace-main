-- Keep canonical authoring provenance beside the immutable question version,
-- never in the browser-safe deliverySpec.
ALTER TABLE "QuestionBankItemVersion"
  ADD COLUMN "sourceTrace" JSONB;
