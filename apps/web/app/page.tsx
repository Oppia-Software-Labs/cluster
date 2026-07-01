import { redirect } from "next/navigation";

// Sending user to /account right away, TODO: make a landing page instead.
export default function Home() {
  redirect("/accounts");
}
