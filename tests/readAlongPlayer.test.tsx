// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReadAlongPlayer } from "../components/ReadAlongPlayer";

describe("ReadAlongPlayer", () => {
  afterEach(cleanup);
  it("renders token progress and routes controls to hook actions", () => {
    const actions = {
      onPlayPause: vi.fn(),
      onBackThreeWords: vi.fn(),
      onForwardThreeWords: vi.fn(),
      onRateChange: vi.fn(),
      onClose: vi.fn(),
    };
    render(
      <ReadAlongPlayer
        speaking={false}
        paused
        rate={1}
        progressPercent={34}
        canMovePrevious
        canMoveNext
        bounds={{ left: 128, width: 640 }}
        {...actions}
      />,
    );
    expect(screen.getByText("34%")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Sesli okumayı başlat"));
    fireEvent.click(screen.getByLabelText("3 kelime geri git"));
    fireEvent.click(screen.getByLabelText("3 kelime ileri git"));
    fireEvent.click(screen.getByLabelText("Sesli okumayı kapat"));
    fireEvent.change(screen.getByLabelText("Okuma hızını değiştir"), {
      target: { value: "1.25" },
    });
    expect(actions.onPlayPause).toHaveBeenCalledOnce();
    expect(actions.onBackThreeWords).toHaveBeenCalledOnce();
    expect(actions.onForwardThreeWords).toHaveBeenCalledOnce();
    expect(actions.onClose).toHaveBeenCalledOnce();
    expect(actions.onRateChange).toHaveBeenCalledWith(1.25);
  });

  it("is fixed, constrained, and disables unavailable word navigation", () => {
    render(
      <ReadAlongPlayer
        speaking
        paused={false}
        rate={1}
        progressPercent={0}
        canMovePrevious={false}
        canMoveNext={false}
        bounds={{ left: 96, width: 720 }}
        onPlayPause={vi.fn()}
        onBackThreeWords={vi.fn()}
        onForwardThreeWords={vi.fn()}
        onRateChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Sesli okumayı duraklat")).toBeTruthy();
    expect(screen.getByLabelText("3 kelime geri git")).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByLabelText("3 kelime ileri git")).toHaveProperty(
      "disabled",
      true,
    );
    expect(
      screen.getByLabelText("Sesli okuma oynatıcısı").className,
    ).toContain("fixed");
    expect(screen.getByLabelText("Sesli okuma oynatıcısı").style.width).toContain("720px");
  });
});
