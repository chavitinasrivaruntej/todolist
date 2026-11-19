import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { TagBadge } from "@/components/tags/tag-badge";

describe("TagBadge Component", () => {
  const sampleTag = {
    id: "tag-1",
    name: "Urgent",
    color: "red",
  };

  it("should render tag name and title attribute", () => {
    render(<TagBadge tag={sampleTag} />);

    expect(screen.getByText("Urgent")).toBeInTheDocument();
    expect(screen.getByTitle("Tag: Urgent")).toBeInTheDocument();
  });

  it("should render remove button when onRemove is provided and handle click", () => {
    const handleRemove = vi.fn();
    render(<TagBadge tag={sampleTag} onRemove={handleRemove} />);

    const removeBtn = screen.getByRole("button", { name: /Remove tag Urgent/i });
    expect(removeBtn).toBeInTheDocument();

    fireEvent.click(removeBtn);
    expect(handleRemove).toHaveBeenCalledTimes(1);
  });

  it("should not render remove button when onRemove is omitted", () => {
    render(<TagBadge tag={sampleTag} />);

    expect(screen.queryByRole("button", { name: /Remove tag/i })).not.toBeInTheDocument();
  });

  it("should trigger onClick when clicked", () => {
    const handleClick = vi.fn();
    render(<TagBadge tag={sampleTag} onClick={handleClick} />);

    fireEvent.click(screen.getByText("Urgent"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
