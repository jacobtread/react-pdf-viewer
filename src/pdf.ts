/**
 * Lots of this code has been adjusted, stripped or rewritten to suit the needs of this project.
 * However there are still decent sized chunks of the code from the pdf.js project specifically
 * https://github.com/mozilla/pdf.js/blob/master/web/app.js thus the license is included below:
 */

/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { PDFDocumentProxy } from "pdfjs-dist";
import * as pdfjsViewer from "pdfjs-dist/web/pdf_viewer.mjs";

type TouchInfo = {
  touch0X: number;
  touch0Y: number;
  touch1X: number;
  touch1Y: number;
};

const DEFAULT_SCALE_VALUE = "auto";

export type PDFViewerConfig = {
  enableHWA?: boolean;
};

export class PDFViewerApp {
  // PDF viewer
  pdfViewer: pdfjsViewer.PDFViewer;

  // Abort controller for window and event bus events
  windowAbortController: AbortController;
  eventBusAbortController: AbortController;

  mainContainer: HTMLDivElement;
  viewerContainer: HTMLDivElement;

  isInitialViewSet: boolean = false;

  _touchInfo: TouchInfo | null = null;
  _touchUnusedTicks: number = 0;
  _touchUnusedFactor: number = 1;

  _isScrolling: boolean = false;
  _isCtrlKeyDown: boolean = false;

  _lastScrollTop: number = 0;
  _lastScrollLeft: number = 0;

  _wheelUnusedTicks: number = 0;
  _wheelUnusedFactor: number = 1;

  constructor(
    mainContainer: HTMLDivElement,
    viewerContainer: HTMLDivElement,
    config: PDFViewerConfig
  ) {
    const eventBus = new pdfjsViewer.EventBus();
    const viewer = new pdfjsViewer.PDFViewer({
      ...config,
      container: mainContainer,
      viewer: viewerContainer,
      eventBus,
    });

    this.mainContainer = mainContainer;
    this.viewerContainer = viewerContainer;
    this.pdfViewer = viewer;

    // Abort controller for window events
    this.windowAbortController = new AbortController();
    // Abort controller for event bus events
    this.eventBusAbortController = new AbortController();

    this.bindWindowEvents();
    this.bindEventBus();
  }

  setDocument(pdfDocument: PDFDocumentProxy | null) {
    const pdfViewer = this.pdfViewer;
    pdfViewer.setDocument(pdfDocument);

    const { firstPagePromise } = pdfViewer;

    // After the first page has loaded update the scale to fit the page
    firstPagePromise.then(() => {
      this.pdfViewer.currentScaleValue = "page-width";
      this.pdfViewer.update();
    });
  }

  clearDocument() {
    const pdfViewer = this.pdfViewer;
    if (this.pdfViewer.pdfDocument) this.pdfViewer.pdfDocument.destroy();
    this.pdfViewer.setDocument(null!);
  }

  /**
   * Binds events associated to the window
   */
  bindWindowEvents() {
    const {
      pdfViewer,
      mainContainer,
      windowAbortController: { signal },
    } = this;

    function addWindowResolutionChange(evt: unknown = null) {
      if (evt) {
        pdfViewer.refresh();
      }
      const mediaQueryList = window.matchMedia(
        `(resolution: ${window.devicePixelRatio || 1}dppx)`
      );
      mediaQueryList.addEventListener("change", addWindowResolutionChange, {
        once: true,
        signal,
      });
    }
    addWindowResolutionChange();

    window.addEventListener("wheel", this.onWheel.bind(this), {
      passive: false,
      signal,
    });

    window.addEventListener("touchstart", this.onTouchStart.bind(this), {
      passive: false,
      signal,
    });
    window.addEventListener("touchmove", this.onTouchMove.bind(this), {
      passive: false,
      signal,
    });
    window.addEventListener("touchend", this.onTouchEnd.bind(this), {
      passive: false,
      signal,
    });
    window.addEventListener("keydown", this.onKeyDown.bind(this), {
      signal,
    });
    window.addEventListener("keyup", this.onKeyUp.bind(this), {
      signal,
    });
    window.addEventListener(
      "resize",
      () => this.pdfViewer.eventBus.dispatch("resize", { source: window }),
      {
        signal,
      }
    );

    const scrollend = () => {
      ({ scrollTop: this._lastScrollTop, scrollLeft: this._lastScrollLeft } =
        mainContainer);

      this._isScrolling = false;
      mainContainer.addEventListener("scroll", scroll, {
        passive: true,
        signal,
      });
      mainContainer.removeEventListener("scrollend", scrollend);
      mainContainer.removeEventListener("blur", scrollend);
    };
    const scroll = () => {
      if (this._isCtrlKeyDown) {
        return;
      }
      if (
        this._lastScrollTop === mainContainer.scrollTop &&
        this._lastScrollLeft === mainContainer.scrollLeft
      ) {
        return;
      }

      mainContainer.removeEventListener("scroll", scroll, {
        passive: true,
      } as never);
      this._isScrolling = true;
      mainContainer.addEventListener("scrollend", scrollend, { signal });
      mainContainer.addEventListener("blur", scrollend, { signal });
    };

    mainContainer.addEventListener("scroll", scroll, {
      passive: true,
      signal,
    });
  }

  /**
   * Binds events associated with the event bus
   */
  bindEventBus() {
    const {
      pdfViewer,
      eventBusAbortController: { signal },
    } = this;

    const eventBus = pdfViewer.eventBus;

    eventBus._on("resize", this.onResize.bind(this), { signal } as any);
    eventBus._on("scalechanging", this.onScaleChanging.bind(this), {
      signal,
    } as never);
    eventBus._on("rotationchanging", this.onRotationChanging.bind(this), {
      signal,
    } as never);
    eventBus._on("zoomin", this.zoomIn.bind(this), { signal } as never);
    eventBus._on("zoomout", this.zoomOut.bind(this), { signal } as never);
  }

  onResize() {
    const { pdfViewer } = this;

    if (!pdfViewer.pdfDocument) {
      return;
    }
    const currentScaleValue = pdfViewer.currentScaleValue;
    if (
      currentScaleValue === "auto" ||
      currentScaleValue === "page-fit" ||
      currentScaleValue === "page-width"
    ) {
      // Note: the scale is constant for 'page-actual'.
      pdfViewer.currentScaleValue = currentScaleValue;
    }
    pdfViewer.update();
  }

  onScaleChanging(_event: Event) {
    this.pdfViewer.update();
  }

  onRotationChanging(evt: { pageNumber: number }) {
    // Ensure that the active page doesn't change during rotation.
    this.pdfViewer.currentPageNumber = evt.pageNumber;
  }

  onKeyDown(event: KeyboardEvent) {
    this._isCtrlKeyDown = event.key === "Control";

    const cmd =
      (event.ctrlKey ? 1 : 0) |
      (event.altKey ? 2 : 0) |
      (event.shiftKey ? 4 : 0) |
      (event.metaKey ? 8 : 0);

    // First, handle the key bindings that are independent whether an input
    // control is selected or not.
    if (cmd === 1 || cmd === 8 || cmd === 5 || cmd === 12) {
      switch (event.code) {
        case "Equal":
        case "NumpadEqual":
          this.zoomIn();
          event.preventDefault();
          break;
        case "Minus":
        case "NumpadSubtract":
          this.zoomOut();
          event.preventDefault();
          break;
        case "Digit0":
        case "Numpad0":
          setTimeout(() => {
            // ... and resetting the scale after browser adjusts its scale
            this.zoomReset();
          });
          event.preventDefault();
          break;
      }
    }
  }

  onKeyUp(event: KeyboardEvent) {
    // Handle control key released
    if (event.key === "Control") {
      this._isCtrlKeyDown = false;
    }
  }

  /**
   * Handles pinch to zoom triggered by track-pads
   * or holding the control key and scrolling
   *
   * @param event
   */
  onWheel(event: WheelEvent) {
    const { pdfViewer } = this;

    const supportsMouseWheelZoomCtrlKey = true;
    const supportsMouseWheelZoomMetaKey = true;
    const supportsPinchToZoom = true;

    if (pdfViewer.isInPresentationMode) {
      return;
    }

    // Pinch-to-zoom on a trackpad maps to a wheel event with ctrlKey set to true
    // https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent#browser_compatibility
    // Hence if ctrlKey is true but ctrl key hasn't been pressed then we can
    // infer that we have a pinch-to-zoom.
    // But the ctrlKey could have been pressed outside of the browser window,
    // hence we try to do some magic to guess if the scaleFactor is likely coming
    // from a pinch-to-zoom or not.

    // It is important that we query deltaMode before delta{X,Y}, so that
    // Firefox doesn't switch to DOM_DELTA_PIXEL mode for compat with other
    // browsers, see https://bugzilla.mozilla.org/show_bug.cgi?id=1392460.
    const deltaMode = event.deltaMode;

    // The following formula is a bit strange but it comes from:
    // https://searchfox.org/mozilla-central/rev/d62c4c4d5547064487006a1506287da394b64724/widget/InputData.cpp#618-626
    let scaleFactor = Math.exp(-event.deltaY / 100);

    const isBuiltInMac = false;
    const isPinchToZoom =
      event.ctrlKey &&
      !this._isCtrlKeyDown &&
      deltaMode === WheelEvent.DOM_DELTA_PIXEL &&
      event.deltaX === 0 &&
      (Math.abs(scaleFactor - 1) < 0.05 || isBuiltInMac) &&
      event.deltaZ === 0;
    const origin = [event.clientX, event.clientY];

    if (
      isPinchToZoom ||
      (event.ctrlKey && supportsMouseWheelZoomCtrlKey) ||
      (event.metaKey && supportsMouseWheelZoomMetaKey)
    ) {
      // Only zoom the pages, not the entire viewer.
      event.preventDefault();

      // NOTE: this check must be placed *after* preventDefault.
      if (this._isScrolling || document.visibilityState === "hidden") {
        return;
      }

      if (isPinchToZoom && supportsPinchToZoom) {
        scaleFactor = this._accumulateFactor(
          pdfViewer.currentScale,
          scaleFactor,
          "_wheelUnusedFactor"
        );

        this.pdfViewer.updateScale({
          scaleFactor,
          origin,
        });
      } else {
        const delta = normalizeWheelEventDirection(event);

        let ticks = 0;
        if (
          deltaMode === WheelEvent.DOM_DELTA_LINE ||
          deltaMode === WheelEvent.DOM_DELTA_PAGE
        ) {
          // For line-based devices, use one tick per event, because different
          // OSs have different defaults for the number lines. But we generally
          // want one "clicky" roll of the wheel (which produces one event) to
          // adjust the zoom by one step.
          //
          // If we're getting fractional lines (I can't think of a scenario
          // this might actually happen), be safe and use the accumulator.
          ticks =
            Math.abs(delta) >= 1
              ? Math.sign(delta)
              : this._accumulateTicks(delta, "_wheelUnusedTicks");
        } else {
          // pixel-based devices
          const PIXELS_PER_LINE_SCALE = 30;
          ticks = this._accumulateTicks(
            delta / PIXELS_PER_LINE_SCALE,
            "_wheelUnusedTicks"
          );
        }

        this.pdfViewer.updateScale({
          steps: ticks,
          origin,
        });
      }
    }
  }

  onTouchStart(event: TouchEvent) {
    // Ignore touches with less than two points
    if (event.touches.length < 2) return;

    // Clear touch info if too many touches are gained
    if (event.touches.length !== 2) {
      this._touchInfo = null;
      return;
    }

    event.preventDefault();

    let [touch0, touch1] = event.touches;

    if (touch0.identifier > touch1.identifier) {
      const tempTouch0 = touch0;
      const tempTouch1 = touch1;

      touch0 = tempTouch1;
      touch1 = tempTouch0;
    }

    // Store touch info
    this._touchInfo = {
      touch0X: touch0.pageX,
      touch0Y: touch0.pageY,
      touch1X: touch1.pageX,
      touch1Y: touch1.pageY,
    };
  }

  onTouchEnd(event: TouchEvent) {
    // Ignore touch end when touch start is unknown
    if (this._touchInfo === null) return;

    event.preventDefault();
    this._touchInfo = null;
    this._touchUnusedTicks = 0;
    this._touchUnusedFactor = 1;
  }

  /**
   * Handles moving of touches for pinch to zoom
   *
   * @param event Touch event
   */
  onTouchMove(event: TouchEvent) {
    if (!this._touchInfo || event.touches.length !== 2) {
      return;
    }

    const { pdfViewer, _touchInfo } = this;

    let [touch0, touch1] = event.touches;
    if (touch0.identifier > touch1.identifier) {
      const tempTouch0 = touch0;
      const tempTouch1 = touch1;

      touch0 = tempTouch1;
      touch1 = tempTouch0;
    }

    const { pageX: page0X, pageY: page0Y } = touch0;
    const { pageX: page1X, pageY: page1Y } = touch1;
    const {
      touch0X: pTouch0X,
      touch0Y: pTouch0Y,
      touch1X: pTouch1X,
      touch1Y: pTouch1Y,
    } = _touchInfo;

    if (
      Math.abs(pTouch0X - page0X) <= 1 &&
      Math.abs(pTouch0Y - page0Y) <= 1 &&
      Math.abs(pTouch1X - page1X) <= 1 &&
      Math.abs(pTouch1Y - page1Y) <= 1
    ) {
      // Touches are really too close and it's hard do some basic
      // geometry in order to guess something.
      return;
    }

    _touchInfo.touch0X = page0X;
    _touchInfo.touch0Y = page0Y;
    _touchInfo.touch1X = page1X;
    _touchInfo.touch1Y = page1Y;

    if (pTouch0X === page0X && pTouch0Y === page0Y) {
      // First touch is fixed, if the vectors are collinear then we've a pinch.
      const v1X = pTouch1X - page0X;
      const v1Y = pTouch1Y - page0Y;
      const v2X = page1X - page0X;
      const v2Y = page1Y - page0Y;
      const det = v1X * v2Y - v1Y * v2X;
      // 0.02 is approximatively sin(0.15deg).
      if (Math.abs(det) > 0.02 * Math.hypot(v1X, v1Y) * Math.hypot(v2X, v2Y)) {
        return;
      }
    } else if (pTouch1X === page1X && pTouch1Y === page1Y) {
      // Second touch is fixed, if the vectors are collinear then we've a pinch.
      const v1X = pTouch0X - page1X;
      const v1Y = pTouch0Y - page1Y;
      const v2X = page0X - page1X;
      const v2Y = page0Y - page1Y;
      const det = v1X * v2Y - v1Y * v2X;
      if (Math.abs(det) > 0.02 * Math.hypot(v1X, v1Y) * Math.hypot(v2X, v2Y)) {
        return;
      }
    } else {
      const diff0X = page0X - pTouch0X;
      const diff1X = page1X - pTouch1X;
      const diff0Y = page0Y - pTouch0Y;
      const diff1Y = page1Y - pTouch1Y;
      const dotProduct = diff0X * diff1X + diff0Y * diff1Y;
      if (dotProduct >= 0) {
        // The two touches go in almost the same direction.
        return;
      }
    }

    event.preventDefault();

    const origin = [(page0X + page1X) / 2, (page0Y + page1Y) / 2];
    const distance = Math.hypot(page0X - page1X, page0Y - page1Y) || 1;
    const pDistance = Math.hypot(pTouch0X - pTouch1X, pTouch0Y - pTouch1Y) || 1;
    const newScaleFactor = this._accumulateFactor(
      pdfViewer.currentScale,
      distance / pDistance,
      "_touchUnusedFactor"
    );

    this.pdfViewer.updateScale({
      scaleFactor: newScaleFactor,
      origin,
    });
  }

  _accumulateTicks(ticks, prop) {
    // If the direction changed, reset the accumulated ticks.
    if ((this[prop] > 0 && ticks < 0) || (this[prop] < 0 && ticks > 0)) {
      this[prop] = 0;
    }
    this[prop] += ticks;
    const wholeTicks = Math.trunc(this[prop]);
    this[prop] -= wholeTicks;
    return wholeTicks;
  }

  _accumulateFactor(previousScale, factor, prop) {
    if (factor === 1) {
      return 1;
    }
    // If the direction changed, reset the accumulated factor.
    if ((this[prop] > 1 && factor < 1) || (this[prop] < 1 && factor > 1)) {
      this[prop] = 1;
    }

    const newFactor =
      Math.floor(previousScale * factor * this[prop] * 100) /
      (100 * previousScale);
    this[prop] = factor / newFactor;

    return newFactor;
  }

  zoomIn() {
    this.pdfViewer.updateScale({ steps: 1 });
  }

  zoomOut() {
    this.pdfViewer.updateScale({ steps: -1 });
  }

  zoomReset() {
    this.pdfViewer.currentScaleValue = DEFAULT_SCALE_VALUE;
  }

  destroy() {
    // Remove event listeners
    this.windowAbortController.abort();
    this.eventBusAbortController.abort();

    // Cleanup the viewer
    this.pdfViewer.cleanup();

    // Clear the innerHTML of the viewer
    this.viewerContainer.innerHTML = "";

    if (this.pdfViewer.pdfDocument) {
      this.pdfViewer.pdfDocument.destroy();
      this.pdfViewer.setDocument(null!);
    }

    this.pdfViewer.linkService.externalLinkEnabled = true;
    this.pdfViewer.cleanup();
  }
}

function normalizeWheelEventDirection(event: WheelEvent) {
  let delta = Math.hypot(event.deltaX, event.deltaY);
  const angle = Math.atan2(event.deltaY, event.deltaX);
  if (-0.25 * Math.PI < angle && angle < 0.75 * Math.PI) {
    // All that is left-up oriented has to change the sign.
    delta = -delta;
  }
  return delta;
}
