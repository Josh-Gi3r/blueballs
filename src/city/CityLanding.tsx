import { useEffect, useRef } from "react";
import { BrandLockup } from "../Brand";
import { coverFrame, type CoverFrame } from "./frontCover";
import "./city.css";

type CoverAcceptance = CoverFrame & {
  testOnly: true;
  panelRevealed: boolean;
  seek: (progress: number) => void;
  enter: () => void;
  revealPanel: () => void;
  hidePanel: () => void;
};

declare global {
  interface Window {
    __blueballsCover?: CoverAcceptance;
  }
}

export default function CityLanding() {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const acceptance =
      new URLSearchParams(location.search).get("acceptance") === "1";
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer =
      matchMedia("(hover: hover) and (pointer: fine)").matches &&
      innerWidth > 760;
    root.dataset.acceptance = acceptance ? "true" : "false";
    root.dataset.panelRevealed = "true";
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    let panelHovered = false;

    const setPanelRevealed = (revealed: boolean) => {
      root.dataset.panelRevealed = revealed ? "true" : "false";
      if (window.__blueballsCover)
        window.__blueballsCover.panelRevealed = revealed;
    };

    const cancelHide = () => {
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = undefined;
    };

    const revealPanel = () => {
      cancelHide();
      setPanelRevealed(true);
    };

    const queueHide = (delay = 2100) => {
      if (
        !finePointer ||
        reduceMotion ||
        panelHovered ||
        root.contains(document.activeElement)
      )
        return;
      cancelHide();
      hideTimer = setTimeout(() => setPanelRevealed(false), delay);
    };

    const hidePanel = () => {
      cancelHide();
      if (!panelHovered && !root.contains(document.activeElement))
        setPanelRevealed(false);
    };

    const render = (frame: CoverFrame) => {
      root.style.setProperty("--cover-progress", frame.progress.toFixed(4));
      root.style.setProperty("--cover-scale", frame.imageScale.toFixed(4));
      root.style.setProperty("--cover-shift", `${frame.imageShift}px`);
      root.style.setProperty(
        "--cover-card-opacity",
        frame.cardOpacity.toFixed(4),
      );
      root.style.setProperty("--cover-card-shift", `${frame.cardShift}px`);
      root.style.setProperty("--cover-opacity", frame.coverOpacity.toFixed(4));
      root.style.setProperty(
        "--cover-home-reveal",
        frame.homeReveal.toFixed(4),
      );
      root.dataset.complete = frame.progress >= 0.995 ? "true" : "false";
      if (window.__blueballsCover)
        Object.assign(window.__blueballsCover, frame);
    };

    const readProgress = () => {
      const distance = Math.max(1, root.offsetHeight);
      return (scrollY - root.offsetTop) / distance;
    };

    const onScroll = () => {
      if (!acceptance && !reduceMotion) render(coverFrame(readProgress()));
    };

    const enter = () => {
      if (window.location.pathname !== "/home")
        window.history.pushState({}, "", "/home");
      window.dispatchEvent(new PopStateEvent("popstate"));
      window.scrollTo(0, 0);
    };

    const buttons =
      root.querySelectorAll<HTMLButtonElement>("[data-cover-enter]");
    const panel = root.querySelector<HTMLElement>(".cover-panel");
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || !finePointer) return;
      revealPanel();
      queueHide();
    };
    const onPointerLeave = () => queueHide(700);
    const onPanelEnter = () => {
      panelHovered = true;
      revealPanel();
    };
    const onPanelLeave = () => {
      panelHovered = false;
      queueHide(900);
    };
    const onFocusIn = () => revealPanel();
    const onFocusOut = () => queueHide(700);
    buttons.forEach((button) => button.addEventListener("click", enter));
    root.addEventListener("pointermove", onPointerMove);
    root.addEventListener("pointerleave", onPointerLeave);
    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("focusout", onFocusOut);
    panel?.addEventListener("pointerenter", onPanelEnter);
    panel?.addEventListener("pointerleave", onPanelLeave);

    if (acceptance) {
      window.__blueballsCover = {
        ...coverFrame(0),
        testOnly: true,
        panelRevealed: root.dataset.panelRevealed === "true",
        seek: (progress: number) => render(coverFrame(progress)),
        enter,
        revealPanel,
        hidePanel,
      };
      render(coverFrame(0));
    } else {
      render(coverFrame(reduceMotion ? 0 : readProgress()));
      addEventListener("scroll", onScroll, { passive: true });
    }

    return () => {
      removeEventListener("scroll", onScroll);
      cancelHide();
      buttons.forEach((button) => button.removeEventListener("click", enter));
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerleave", onPointerLeave);
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("focusout", onFocusOut);
      panel?.removeEventListener("pointerenter", onPanelEnter);
      panel?.removeEventListener("pointerleave", onPanelLeave);
      delete window.__blueballsCover;
    };
  }, []);

  return (
    <main
      className="cover-landing"
      ref={rootRef}
      data-complete="false"
      data-panel-revealed="false"
    >
      <div className="cover-stage">
        <div className="cover-world" aria-hidden="true">
          <div className="cover-image cover-image-far" />
          <div className="cover-foundation-line" />
          <div className="cover-vignette" />
        </div>

        <header className="cover-header">
          <a href="/" className="cover-logo" aria-label="Blueballs home">
            <BrandLockup inverse linked={false} />
            <span className="cover-logo-tagline">
              OPEN-SOURCE FINANCIAL INFRASTRUCTURE
            </span>
          </a>
          <button type="button" data-cover-enter className="cover-header-enter">
            <span>01 / 01</span>
            ENTER <b aria-hidden="true">→</b>
          </button>
        </header>

        <button
          type="button"
          data-cover-enter
          className="cover-panel"
          aria-labelledby="cover-title"
        >
          <div className="cover-eyebrow">
            <i />
            OPEN-SOURCE FINANCIAL INFRASTRUCTURE
          </div>
          <h1 id="cover-title">
            Build the financial institution your market needs.
          </h1>
          <p>
            Accounts, cards, transfers, wallets and FX in one open-source stack.
            Connect the providers your product needs.
          </p>
          <div className="cover-cta" aria-hidden="true">
            <span>ENTER BLUEBALLS</span>
            <b aria-hidden="true">→</b>
          </div>
          <div className="cover-scroll-cue">
            <i />
            <span>ENTER TO OPEN THE SITE</span>
          </div>
        </button>

        <div className="cover-story-key" aria-label="The Blueballs thesis">
          <span>ONE CLOSED MODEL</span>
          <i />
          <span>SHARED OPEN INFRASTRUCTURE</span>
          <i />
          <span>MANY POSSIBILITIES</span>
        </div>
      </div>
    </main>
  );
}
