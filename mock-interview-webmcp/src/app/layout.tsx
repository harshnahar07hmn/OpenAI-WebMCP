import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mock Interview Coach — WebMCP",
  description:
    "An agent-native mock interview app. Ask ChatGPT to start an interview, then answer on the page.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
