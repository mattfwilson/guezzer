import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __resetInstallStoreForTests,
  getInstallSnapshot,
  promptInstall,
} from "../src/pwa/install/installStore";
import { useInstallState } from "../src/pwa/install/useInstallState";

/**
 * NAV-06 / D-33 / D-36 — the module-level install singleton.
 *
 * `beforeinstallprompt` is one-shot and fires early. The shipped
 * `useInstallState()` captured it in per-hook-instance state, so a consumer
 * mounted after the event fired (the Settings install section, plan 22-06)
 * never saw it — NAV-06 was dead on Android — and `AppMenu` / `InstallBanner`
 * each ran their own listener and their own `isStandalone()` read, so they
 * could disagree. These cases pin the hoisted behaviour.
 *
 * Idiom copied from `bottomOverlayInset.test.tsx`: a tiny Probe component,
 * `act()` around every store mutation, and the `__reset…ForTests` hatch in
 * `afterEach`. No `vi.resetModules()` — the store is deliberately imported
 * exactly once per file, which is the whole point of the singleton.
 */

function Probe({ id }: { id: string }) {
  const { canInstall, isIos, isInstalled } = useInstallState();
  return (
    <div>
      <span data-testid={`${id}-canInstall`}>{String(canInstall)}</span>
      <span data-testid={`${id}-isIos`}>{String(isIos)}</span>
      <span data-testid={`${id}-isInstalled`}>{String(isInstalled)}</span>
    </div>
  );
}

function read(id: string, field: string): string | null {
  return screen.getByTestId(`${id}-${field}`).textContent;
}

/**
 * A synthetic `beforeinstallprompt`. The real event is Chromium-only and not
 * constructible in jsdom, so build a plain `Event` under that name and hang
 * the two members `promptInstall()` awaits onto it.
 */
function makeBeforeInstallPromptEvent(): Event {
  const event = new Event("beforeinstallprompt");
  Object.assign(event, {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
  });
  return event;
}

describe("installStore singleton (NAV-06, D-33, D-36)", () => {
  afterEach(() => {
    cleanup();
    __resetInstallStoreForTests();
  });

  it("a consumer mounted AFTER beforeinstallprompt fired still sees canInstall — the NAV-06 bug", () => {
    // The event fires BEFORE anything renders. This is the exact failure mode
    // of the old component-local capture: the Settings section mounts later.
    window.dispatchEvent(makeBeforeInstallPromptEvent());

    render(<Probe id="late" />);

    expect(read("late", "canInstall")).toBe("true");
  });

  it("two independently-mounted consumers agree, and lose canInstall together (D-33)", async () => {
    render(<Probe id="a" />);
    render(<Probe id="b" />);

    act(() => {
      window.dispatchEvent(makeBeforeInstallPromptEvent());
    });

    expect(read("a", "canInstall")).toBe("true");
    expect(read("b", "canInstall")).toBe("true");

    // The D-33 fix: firing the prompt notifies EVERY subscriber, not just the
    // one that called it. Before the hoist, the other surface kept offering an
    // install button backed by an already-consumed event.
    await act(async () => {
      await promptInstall();
    });

    expect(read("a", "canInstall")).toBe("false");
    expect(read("b", "canInstall")).toBe("false");
  });

  it("isStandalone() is evaluated once and shared by every consumer (D-36)", () => {
    // The override exists precisely BECAUSE the real read is frozen at module
    // load — a page never transitions into standalone mode, so the store never
    // re-evaluates it, and a test has no other way to reach isInstalled: true.
    __resetInstallStoreForTests({ isInstalled: true });
    render(<Probe id="a" />);
    render(<Probe id="b" />);

    expect(read("a", "isInstalled")).toBe("true");
    expect(read("b", "isInstalled")).toBe("true");

    cleanup();
    __resetInstallStoreForTests({ isInstalled: false });
    render(<Probe id="c" />);
    render(<Probe id="d" />);

    expect(read("c", "isInstalled")).toBe("false");
    expect(read("d", "isInstalled")).toBe("false");
  });

  it("isIos is likewise one shared evaluation, not one per consumer (D-36)", () => {
    __resetInstallStoreForTests({ isIos: true });
    render(<Probe id="a" />);
    render(<Probe id="b" />);

    expect(read("a", "isIos")).toBe("true");
    expect(read("b", "isIos")).toBe("true");
  });

  it("appinstalled flips every consumer in-session, with no reload or remount", () => {
    render(<Probe id="a" />);
    render(<Probe id="b" />);

    act(() => {
      window.dispatchEvent(makeBeforeInstallPromptEvent());
    });
    expect(read("a", "canInstall")).toBe("true");

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });

    // NAV-05's "hidden once installed" now takes effect within the session
    // that performed the install — what the 22-09 Android device test observes.
    expect(read("a", "isInstalled")).toBe("true");
    expect(read("b", "isInstalled")).toBe("true");
    expect(read("a", "canInstall")).toBe("false");
    expect(read("b", "canInstall")).toBe("false");
  });

  it("getInstallSnapshot returns a stable reference while nothing notifies (Pitfall 9)", () => {
    render(<Probe id="a" />);

    // React 19 turns an uncached object snapshot into an infinite render loop
    // ("The result of getSnapshot should be cached"). One line to pin it.
    expect(getInstallSnapshot()).toBe(getInstallSnapshot());

    act(() => {
      window.dispatchEvent(makeBeforeInstallPromptEvent());
    });

    // Still stable after a notify — a NEW object, but cached again.
    expect(getInstallSnapshot()).toBe(getInstallSnapshot());
  });

  it("promptInstall() with nothing captured is a silent no-op and never throws", async () => {
    render(<Probe id="a" />);
    expect(read("a", "canInstall")).toBe("false");

    await expect(promptInstall()).resolves.toBeUndefined();

    expect(read("a", "canInstall")).toBe("false");
  });
});
