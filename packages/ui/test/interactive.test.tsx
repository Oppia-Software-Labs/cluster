import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

describe("interactive primitives", () => {
  it("renders Tabs with a default active panel", () => {
    render(
      <Tabs defaultValue="coins">
        <TabsList>
          <TabsTrigger value="coins">Coins</TabsTrigger>
          <TabsTrigger value="nfts">NFTs</TabsTrigger>
        </TabsList>
        <TabsContent value="coins">Coin list</TabsContent>
        <TabsContent value="nfts">NFT list</TabsContent>
      </Tabs>,
    );
    expect(screen.getByRole("tab", { name: "Coins" })).toBeInTheDocument();
    expect(screen.getByText("Coin list")).toBeInTheDocument();
  });
});
