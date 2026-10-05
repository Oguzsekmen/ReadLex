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
      onPrevious: vi.fn(),
      onNext: vi.fn(),
      onRepeat: vi.fn(),
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
        canRepeat
        {...actions}
      />,
    );
    expect(screen.getByText("34%")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Sesli okumayı başlat"));
    fireEvent.click(screen.getByLabelText("Önceki cümle"));
    fireEvent.click(screen.getByLabelText("Sonraki cümle"));
    fireEvent.click(screen.getByLabelText("Cümleyi tekrar oku"));
    fireEvent.click(screen.getByLabelText("Sesli okumayı kapat"));
    fireEvent.change(screen.getByLabelText("Okuma hızı"), {
      target: { value: "1.25" },
    });
    expect(actions.onPlayPause).toHaveBeenCalledOnce();
    expect(actions.onPrevious).toHaveBeenCalledOnce();
    expect(actions.onNext).toHaveBeenCalledOnce();
    expect(actions.onRepeat).toHaveBeenCalledOnce();
    expect(actions.onClose).toHaveBeenCalledOnce();
    expect(actions.onRateChange).toHaveBeenCalledWith(1.25);
  });

  it("shows pause while speaking and disables unavailable sentence actions", () => {
    render(
      <ReadAlongPlayer
        speaking
        paused={false}
        rate={1}
        progressPercent={0}
        canMovePrevious={false}
        canMoveNext={false}
        canRepeat={false}
        onPlayPause={vi.fn()}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onRepeat={vi.fn()}
        onRateChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Duraklat")).toBeTruthy();
    expect(screen.getByLabelText("Önceki cümle")).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByLabelText("Sonraki cümle")).toHaveProperty(
      "disabled",
      true,
    );
    expect(
      screen.getByLabelText("Sesli okuma oynatıcısı").className,
    ).not.toContain("fixed");
  });
});
