import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import Home from "../../src/routes/Home";

describe("Home", () => {
  it("shows the product name with no axe violations", async () => {
    const { container } = render(<Home />);
    expect(screen.getByRole("heading", { level: 1, name: "Hostwise" })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
