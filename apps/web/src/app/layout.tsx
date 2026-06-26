import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/components/WalletProvider";
import { NavBar } from "@/components/NavBar";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { ThemeBootstrap } from "@/components/ThemeBootstrap";

export const metadata: Metadata = {
  title: "Linkora",
  description: "Decentralised social on Stellar",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeBootstrap />
        <WalletProvider>
          <NotificationsProvider>
            <NavBar />
            <main>{children}</main>
          </NotificationsProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
