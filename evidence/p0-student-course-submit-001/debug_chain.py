"""Debug recording upload chain by directly calling API methods step by step.
Bypasses the button UI and calls each step manually to isolate the failing step.
"""
import json, os, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("YUZAN_E2E_BASE_URL", "http://127.0.0.1:4175").rstrip("/")
IDENTIFIER = os.environ.get("YUZAN_E2E_STUDENT_IDENTIFIER", "student.test")
PASSWORD = os.environ.get("YUZAN_E2E_STUDENT_PASSWORD", "YuzanTest!2026")

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
            headless=True,
        )
        ctx = browser.new_context(
            viewport={"width": 1440, "height": 900},
            permissions=["microphone"],
        )
        page = ctx.new_page()

        # Login
        print("=== LOGIN ===")
        page.goto(f"{BASE_URL}/login/", wait_until="networkidle")
        page.locator("#loginAccount").fill(IDENTIFIER)
        page.locator("#loginPassword").fill(PASSWORD)
        page.locator('[data-action="login"]').click()
        page.wait_for_url(lambda url: "/login" not in url, timeout=15_000)
        page.wait_for_load_state("networkidle")
        print("OK")

        # Step 1: Create a fake audio blob and test the full recording chain
        print("\n=== STEP 1: TEST RECORDING CHAIN MANUALLY ===")
        chain_result = page.evaluate("""async () => {
          const results = { steps: [] };

          try {
            // Step A: Get course state
            const state = CoursePlayerState.getState();
            results.steps.push({ step: 'getState', ok: true, assignmentId: state.assignmentId, submissionId: state.submissionId, enrollmentId: state.enrollmentId });

            if (!state.enrollmentId) {
              results.steps.push({ step: 'error', message: 'No enrollmentId in state' });
              return results;
            }

            // Step B: Create a small fake audio blob
            const fakeAudioData = new Uint8Array(1024);
            for (let i = 0; i < fakeAudioData.length; i++) fakeAudioData[i] = Math.floor(Math.random() * 256);
            const blob = new Blob([fakeAudioData], { type: 'audio/webm' });
            results.steps.push({ step: 'createBlob', ok: true, size: blob.size, type: blob.type });

            // Step C: initRecording
            results.steps.push({ step: 'initRecording', status: 'starting' });
            const initResult = await CourseApiAdapter.initRecording(blob, {
              enrollmentId: state.enrollmentId,
              submissionId: state.submissionId
            });
            results.steps.push({ step: 'initRecording', ok: true, recordingId: initResult.recordingId, uploadUrl: initResult.uploadUrl ? initResult.uploadUrl.substring(0, 80) + '...' : 'EMPTY' });

            if (!initResult.uploadUrl) {
              results.steps.push({ step: 'error', message: 'No uploadUrl returned from initRecording' });
              return results;
            }

            // Step D: uploadRecording (PUT to presigned URL)
            results.steps.push({ step: 'uploadRecording', status: 'starting', url: initResult.uploadUrl.substring(0, 60) + '...' });
            const uploadResult = await CourseApiAdapter.uploadRecording(initResult.uploadUrl, blob);
            results.steps.push({ step: 'uploadRecording', ok: true, result: JSON.stringify(uploadResult).substring(0, 200) });

            // Step E: completeRecording
            results.steps.push({ step: 'completeRecording', status: 'starting', recordingId: initResult.recordingId });
            const completeResult = await CourseApiAdapter.completeRecording(initResult.recordingId);
            results.steps.push({ step: 'completeRecording', ok: true, recordingId: completeResult.recordingId });

            // Step F: linkRecording
            results.steps.push({ step: 'linkRecording', status: 'starting' });
            const linkResult = await CourseApiAdapter.linkRecording(
              state.assignmentId, state.submissionId, state.currentActivityId,
              completeResult.recordingId
            );
            results.steps.push({ step: 'linkRecording', ok: true, result: JSON.stringify(linkResult).substring(0, 200) });

            // Step G: saveActivityAttempt
            results.steps.push({ step: 'saveActivityAttempt', status: 'starting' });
            const saveResult = await CoursePlayerState.saveActivityAttempt(
              state.currentActivityId, 'SPEECH', { recorded: true }, true
            );
            results.steps.push({ step: 'saveActivityAttempt', ok: true, result: JSON.stringify(saveResult).substring(0, 200) });

          } catch (err) {
            results.steps.push({
              step: 'catch',
              error: err.message || String(err),
              stack: err.stack ? err.stack.substring(0, 300) : null,
              status: err.status || 0,
              code: err.code || ''
            });
          }

          return results;
        }""")

        print(json.dumps(chain_result, indent=2, ensure_ascii=False))

        page.screenshot(path=str(Path(__file__).parent / "debug_chain_result.png"))
        browser.close()


if __name__ == "__main__":
    main()
