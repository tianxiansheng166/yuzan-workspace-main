"""Browser-only UI parity fixture for the isolated T027 text adapter."""

from __future__ import annotations

import base64
import io
import os
import wave
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[3]
PLAYER_DIR = ROOT / "frontend" / "student" / "learn" / "spring-2"
EVIDENCE = Path(os.environ.get("YZ_T027_EVIDENCE_DIR", ROOT / "evidence" / "yz-rd-t027"))


def silent_wav_data_url() -> str:
    data = io.BytesIO()
    with wave.open(data, "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(8000)
        audio.writeframes(b"\x00\x00" * 8000 * 4)
    return "data:audio/wav;base64," + base64.b64encode(data.getvalue()).decode("ascii")


def test_yz_rd_t027_reviewed_tibetan_ui_gate_and_media_preservation():
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    screenshot_dir = EVIDENCE / "screenshots"
    screenshot_dir.mkdir(parents=True, exist_ok=True)
    css = (PLAYER_DIR / "style.css").read_text(encoding="utf-8") + "\n" + (PLAYER_DIR / "bilingual-renderer.css").read_text(encoding="utf-8")
    approved = {
        "originalText": "山谷里的春风带来新芽。",
        "translation": "ལུང་པའི་ནང་གི་དཔྱིད་ཀའི་རླུང་གིས་མྱུ་གུ་གསར་པ་ཁྱེར་ཡོང་།",
        "locale": "zh-CN",
        "translationLocale": "bo-CN",
        "translationSource": "COMMUNITY",
        "reviewStatus": "EXPERT_CONFIRMED",
    }
    unsafe = {
        "originalText": '<img src=x onerror="window.__injected=true">中文原文',
        "translation": "<script>window.__injected=true</script>མ་བསྒྱུར།",
        "locale": "zh-CN",
        "translationLocale": "bo-CN",
        "translationSource": "AUTO",
        "reviewStatus": "REVIEWED",
    }
    html = f"""<!doctype html>
      <html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>{css}</style></head>
      <body><main class="learning-page">
        <header class="course-header"><a class="back-link" href="#">返回课程</a><div class="course-heading"><p class="eyebrow">单元 · 课时</p><h1>河谷春日</h1></div><div class="course-status"><strong>0%</strong><span>课程学习中</span></div></header>
        <div class="learning-layout"><article class="activity-stage">
          <header class="activity-heading"><span class="type-label">阅读</span><h2>春日观察</h2><div id="instruction" class="activity-instruction"></div></header>
          <div id="activityContent" class="activity-content" aria-live="polite">
            <div id="objectives"></div><div id="body"></div><fieldset id="choice" class="answer-field"><legend>选择一个答案</legend></fieldset>
            <figure class="media-block"><audio id="media" controls aria-label="播放课程音频"></audio><figcaption id="caption"></figcaption></figure>
            <section id="target" class="speech-target"></section><section id="feedback"></section><div id="unsafe"></div><div id="unreviewed"></div>
            <label for="answer">你的回答</label><textarea id="answer">已写好的答案</textarea>
          </div>
          <footer class="activity-footer"><button type="button" class="quiet-button">上一个活动</button><p id="syncState" role="status">服务器记录：尚未完成本活动</p><button type="button" class="primary-button">保存完成状态</button></footer>
        </article><aside class="learning-aside"><section class="course-points"><h2>课程学习目标</h2><div>观察课文中的春日变化</div></section><section class="private-note"><h2>学习笔记</h2><textarea id="note">保留学习笔记</textarea></section></aside></div>
      </main></body></html>"""

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path="/usr/bin/google-chrome",
            args=["--autoplay-policy=no-user-gesture-required"],
        )
        page = browser.new_page(viewport={"width": 1280, "height": 920})
        page.set_content(html, wait_until="domcontentloaded")
        page.add_script_tag(path=str(PLAYER_DIR / "bilingual-renderer.js"))
        page.evaluate(
            """({ approved, unsafe, audioUrl }) => {
              const renderer = window.YuzanBilingualRenderer;
              renderer.appendBilingualText(document.querySelector('#instruction'), approved, { tagName: 'span' });
              renderer.appendBilingualText(document.querySelector('#objectives'), { body: approved }, { tagName: 'span' });
              renderer.appendBilingualText(document.querySelector('#body'), { text: approved }, { tagName: 'p', className: 'reading-paragraph' });
              const option = document.createElement('div');
              option.className = 'answer-option-row';
              const label = document.createElement('label');
              const radio = document.createElement('input');
              radio.type = 'radio'; radio.name = 'choice'; radio.checked = true;
              const optionText = document.createElement('span'); optionText.textContent = approved.originalText;
              label.append(radio, optionText); option.append(label);
              renderer.appendTranslationAssist(option, approved);
              document.querySelector('#choice').append(option);
              renderer.appendBilingualText(document.querySelector('#caption'), approved, { tagName: 'span' });
              renderer.appendBilingualText(document.querySelector('#target'), approved, { tagName: 'blockquote' });
              renderer.appendBilingualText(document.querySelector('#feedback'), approved, { tagName: 'p' });
              renderer.appendBilingualText(document.querySelector('#unsafe'), unsafe, { tagName: 'p' });
              renderer.appendBilingualText(document.querySelector('#unreviewed'), { ...approved, translationSource: 'AUTO', reviewStatus: 'REVIEWED' }, { tagName: 'p' });
              document.querySelector('#media').src = audioUrl;
            }""",
            {"approved": approved, "unsafe": unsafe, "audioUrl": silent_wav_data_url()},
        )
        page.evaluate("document.querySelector('#media').play()")
        page.wait_for_function("document.querySelector('#media').currentTime > 0.08", timeout=10_000)

        approved_buttons = page.get_by_role("button", name="查看藏语辅助说明", exact=True)
        expect(approved_buttons).to_have_count(7)
        first = approved_buttons.first
        assert first.get_attribute("aria-expanded") == "false"
        control_ids = [button.get_attribute("aria-controls") for button in approved_buttons.all()]
        assert len(control_ids) == len(set(control_ids)) == 7
        assert page.locator(f"#{control_ids[0]}").is_hidden()
        assert page.locator(f"#{control_ids[0]}").get_attribute("lang") == "bo"
        assert page.locator(f"#{control_ids[0]}").get_attribute("dir") == "auto"
        assert page.locator(".bilingual-badge").all_text_contents() == ["已审核藏语辅助"] * 7
        assert page.locator("#unsafe img, #unsafe script, #unreviewed .bilingual-toggle, #unreviewed .bilingual-badge").count() == 0
        assert page.locator("#unsafe .bilingual-original").inner_text() == '<img src=x onerror="window.__injected=true">中文原文'
        assert page.evaluate("window.__injected === undefined")
        assert page.locator("#unreviewed .bilingual-original").inner_text() == "山谷里的春风带来新芽。"

        page.screenshot(path=str(screenshot_dir / "bilingual-original-1280.png"), full_page=True)
        first.focus()
        page.keyboard.press("Enter")
        expect(first).to_have_attribute("aria-expanded", "true")
        expect(page.locator(f"#{control_ids[0]}")).to_be_visible()
        expect(page.locator(f"#{control_ids[0]}")).to_contain_text(approved["translation"])
        assert page.evaluate("document.activeElement === document.querySelector('.bilingual-toggle')")
        page.keyboard.press("Escape")
        expect(first).to_have_attribute("aria-expanded", "false")
        assert page.evaluate("document.activeElement === document.querySelector('.bilingual-toggle')")
        page.keyboard.press("Space")
        expect(first).to_have_attribute("aria-expanded", "true")
        page.wait_for_timeout(180)
        assert page.locator("#answer").input_value() == "已写好的答案"
        assert page.locator("#note").input_value() == "保留学习笔记"
        assert page.locator("input[name=choice]").is_checked()
        page.wait_for_function("document.querySelector('#media').paused === false && document.querySelector('#media').currentTime > 0.1")
        page.screenshot(path=str(screenshot_dir / "bilingual-approved-1280.png"), full_page=True)

        for width, height in ((390, 844), (768, 900), (1280, 920), (1440, 960)):
            page.set_viewport_size({"width": width, "height": height})
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), f"horizontal overflow at {width}px"
            if width == 390:
                page.screenshot(path=str(screenshot_dir / "bilingual-approved-390.png"), full_page=True)
        assert page.evaluate("getComputedStyle(document.querySelector('.bilingual-help-text')).fontFamily").find("Tibetan Machine Uni") >= 0
        page.emulate_media(reduced_motion="reduce")
        assert page.locator(".bilingual-help-panel").first.evaluate("element => getComputedStyle(element).animationDuration") in {"0s", "0.0s"}

        browser.close()
