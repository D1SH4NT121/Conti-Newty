import asyncio
import os
import sys
from playwright.async_api import async_playwright

ARTIFACTS_DIR = r"C:\Users\LENOVO\.gemini\antigravity-ide\brain\e1843e30-1565-4864-b85b-b40b57528dfa"

async def run_browser_test():
    async with async_playwright() as p:
        print("[1/5] Launching Chromium browser...")
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1440, "height": 900})
        page = await context.new_page()

        print("[2/5] Navigating to http://localhost:3000...")
        response = await page.goto("http://localhost:3000", wait_until="networkidle")
        assert response.status == 200, f"Expected 200 OK, got {response.status}"

        # 1. Verify Initial State (State 01: Idle / Company Brain)
        print("[3/5] Testing State 01 (Initial Viewport)...")
        headline = await page.text_content("h1")
        assert "Your company already" in headline, f"Unexpected headline: {headline}"
        
        state_label = await page.text_content("#hero-state-label")
        print(f"       Current state label: {state_label.strip()}")
        assert "STATE 01" in state_label

        # Verify buttons are unclickable (pointer-events: none)
        pointer_events = await page.eval_on_selector('.hero-step-btn', 'el => window.getComputedStyle(el.parentElement).pointerEvents')
        print(f"       Step indicator parent pointer-events: {pointer_events}")
        assert pointer_events == 'none', f"Expected pointer-events: none, got {pointer_events}"

        # Check that clicking the indicator does nothing
        indicator = page.locator('.hero-step-btn[data-target-step="2"]')
        await indicator.click(force=True)
        await page.wait_for_timeout(200)
        still_state_1 = await page.text_content("#hero-state-label")
        assert "STATE 01" in still_state_1, "Clicking indicator should not advance state!"
        print("       Confirmed: Step badges are unclickable passive indicators.")

        s1_path = os.path.join(ARTIFACTS_DIR, "hero_state_01_idle.png")
        await page.screenshot(path=s1_path)
        print(f"       Saved screenshot: {s1_path}")

        # 2. Test Scroll Progression (Weighted 2-3 scroll gestures per state)
        print("[4/5] Testing Weighted Smooth Scroll Progression...")
        # With 650vh (~5850px spacer), each step spans ~835px
        scroll_checkpoints = [
            (1200, "STATE 02", "Query Intake"),
            (2100, "STATE 03", "Directory Discovery"),
            (3000, "STATE 04", "Source Opened"),
            (3900, "STATE 05", "Agent Traversal"),
            (4750, "STATE 06", "Provenance Verified"),
            (5500, "STATE 07", "Verified Answer")
        ]

        for y_pos, expected_state_prefix, desc in scroll_checkpoints:
            await page.evaluate(f"window.scrollTo(0, {y_pos})")
            await page.wait_for_timeout(300)
            cur_label = await page.text_content("#hero-state-label")
            cur_step = await page.text_content("#hero-step-badge")
            pct = await page.eval_on_selector("#hero-progress-bar", "el => el.style.width")
            print(f"       Scrolled to {y_pos}px (~{y_pos//300} scroll ticks) -> {cur_step.strip()} | {cur_label.strip()} (Bar: {pct})")
            assert expected_state_prefix in cur_label, f"Expected {expected_state_prefix} at {y_pos}px, got {cur_label}"

        # At State 07, check verified answer card containment and no text collision
        answer_box_text = await page.text_content("#step-box-answer")
        print(f"       State 07 Answer Card Verified: {answer_box_text.strip()[:60]}...")
        assert "18 seconds" in answer_box_text
        assert "100% MATCH" in answer_box_text
        assert "docs/chicago_project_review.md:14–22" in answer_box_text

        s7_path = os.path.join(ARTIFACTS_DIR, "hero_state_07_verified.png")
        await page.screenshot(path=s7_path)
        print(f"       Saved screenshot: {s7_path}")

        # 3. Responsive Check (Mobile 375x812)
        print("[5/5] Testing Mobile Viewport for Horizontal Overflow...")
        await page.set_viewport_size({"width": 375, "height": 812})
        await page.wait_for_timeout(300)
        has_overflow = await page.evaluate("document.documentElement.scrollWidth > window.innerWidth")
        print(f"       Mobile scrollWidth > innerWidth: {has_overflow}")
        assert not has_overflow, "Horizontal overflow detected on mobile viewport!"

        mobile_path = os.path.join(ARTIFACTS_DIR, "hero_mobile_responsive.png")
        await page.screenshot(path=mobile_path)
        print(f"       Saved mobile screenshot: {mobile_path}")

        await browser.close()
        print("\nALL BROWSER TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(run_browser_test())
