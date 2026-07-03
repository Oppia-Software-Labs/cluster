import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

describe("base primitives", () => {
  it("renders a Card with title and content", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Balance</CardTitle>
        </CardHeader>
        <CardContent>123</CardContent>
      </Card>,
    );
    expect(screen.getByText("Balance")).toBeInTheDocument();
    expect(screen.getByText("123")).toBeInTheDocument();
  });

  it("renders an Input with a placeholder", () => {
    render(<Input placeholder="Search" />);
    expect(screen.getByPlaceholderText("Search")).toBeInTheDocument();
  });

  it("renders a Badge as a pill", () => {
    render(<Badge>2/3</Badge>);
    expect(screen.getByText("2/3")).toBeInTheDocument();
  });

  it("renders an Avatar fallback", () => {
    render(
      <Avatar>
        <AvatarFallback>CL</AvatarFallback>
      </Avatar>,
    );
    expect(screen.getByText("CL")).toBeInTheDocument();
  });
});
