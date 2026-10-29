import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { axe } from "vitest-axe";
import { RankControl } from "../../src/components/intake/RankControl";

const LABELS = { food: "Food", venue: "Venue", decor: "Décor", photography: "Photography" };

function Demo({ onChange }: { onChange?: (v: string[]) => void }) {
  const [value, setValue] = useState(["food", "venue", "decor", "photography"]);
  return (
    <RankControl
      legend="Priorities"
      labels={LABELS}
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
    />
  );
}

const order = () =>
  within(screen.getByRole("list"))
    .getAllByRole("listitem")
    .map((li) => li.textContent?.match(/Position \d+: (\D+?)(Top|$)/)?.[1]);

describe("RankControl", () => {
  it("has no axe violations and labels each button with its item", async () => {
    const { container } = render(<Demo />);
    expect(await axe(container)).toHaveNoViolations();
    expect(screen.getByRole("button", { name: "Move Food up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Photography down" })).toBeDisabled();
  });

  it("reorders with the arrow buttons and focus follows the moved item", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Demo onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Move Décor up" }));
    expect(order()).toEqual(["Food", "Décor", "Venue", "Photography"]);
    expect(screen.getByRole("button", { name: "Move Décor up" })).toHaveFocus();
    expect(screen.getByText("Décor moved to position 2")).toBeInTheDocument();

    await user.keyboard("{Enter}");
    expect(order()).toEqual(["Décor", "Food", "Venue", "Photography"]);
    // The up button is now disabled, so focus moves to the item's down button.
    expect(screen.getByRole("button", { name: "Move Décor down" })).toHaveFocus();
    expect(screen.getByText("Décor moved to position 1")).toBeInTheDocument();

    await user.keyboard(" ");
    expect(order()).toEqual(["Food", "Décor", "Venue", "Photography"]);
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it("marks the top three items in text", () => {
    render(<Demo />);
    expect(screen.getAllByText("Top 3")).toHaveLength(3);
  });
});
