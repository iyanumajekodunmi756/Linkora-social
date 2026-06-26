"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWallet } from "@/hooks/useWallet";
import SearchBar from "@/components/SearchBar";
import { useNotificationsContext } from "@/contexts/NotificationsContext";
import { PostComposeModal } from "./PostComposeModal";

/** Truncates a Stellar address to G…XXXX format */
function truncateAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function NavBar() {
  const router = useRouter();
  const { address, connected, network, connect, disconnect } = useWallet();
  const { unreadCount } = useNotificationsContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showFreighterBanner, setShowFreighterBanner] = useState(false);

  const handleConnect = useCallback(async () => {
    const hasFreighter =
      typeof window !== "undefined" &&
      !!(window as unknown as { freighter?: unknown }).freighter;
    if (!hasFreighter) {
      setShowFreighterBanner(true);
      return;
    }
    await connect();
  }, [connect]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-sm">
      {/* Freighter not-installed banner */}
      {showFreighterBanner && (
        <div className="flex items-center justify-between gap-4 bg-amber-950/60 border-b border-amber-700/50 px-4 py-2.5 text-sm" role="alert">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-bold">Freighter not detected.</span>
            <span className="text-amber-200/80">
              Install the{" "}
              <a
                href="https://freighter.app"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold text-amber-300 hover:text-amber-200"
              >
                Freighter browser extension
              </a>{" "}
              to connect your wallet.
            </span>
          </div>
          <button
            onClick={() => setShowFreighterBanner(false)}
            className="shrink-0 text-amber-400/70 hover:text-amber-300 transition-colors"
            aria-label="Dismiss banner"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      <nav className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Brand */}
        <a
          href="/"
          className="text-xl font-extrabold tracking-tight text-violet-500 hover:text-violet-400 transition-colors"
        >
          Linkora
        </a>

        <SearchBar
          onSearch={(query) => router.push(`/search?q=${encodeURIComponent(query)}`)}
          placeholder="Search posts and profiles"
          className="w-full max-w-xl sm:flex-1"
        />

        {/* Right side */}
        <div className="flex items-center gap-3">
          {connected && (
            <>
              <Link
                href="/governance"
                className="rounded-lg p-1.5 text-[var(--text-muted)] hover:text-violet-400 transition-colors"
                aria-label="Governance"
                data-testid="governance-link"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" />
                </svg>
              </Link>
              <Link
                href="/notifications"
                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
                className="relative rounded-lg p-1.5 text-[var(--text-muted)] hover:text-violet-400 transition-colors"
                data-testid="notifications-bell"
              >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
                />
              </svg>
              {unreadCount > 0 && (
                <span
                  className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-violet-500 text-[10px] font-bold text-white"
                  aria-hidden="true"
                  data-testid="unread-badge"
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
            </>
          )}
          {connected && address ? (
            <>
              {/* Compose button */}
              <button
                onClick={() => setIsModalOpen(true)}
                className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-violet-500 transition-colors"
                aria-label="Compose new post"
              >
                Compose
              </button>

              {/* Network badge */}
              {network && (
                <span className="hidden sm:inline-flex items-center rounded-full bg-violet-900/40 px-2.5 py-0.5 text-xs font-medium text-violet-300 border border-violet-700/50">
                  {network}
                </span>
              )}

              {/* Address chip */}
              <span
                className="font-mono text-sm text-[var(--foreground)] bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-1.5 select-all"
                title={address}
                aria-label={`Connected address: ${address}`}
                data-testid="wallet-address"
              >
                {truncateAddress(address)}
              </span>

              {/* Disconnect */}
              <button
                onClick={disconnect}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text-muted)] hover:border-red-500/60 hover:text-red-400 transition-colors"
                aria-label="Disconnect wallet"
                data-testid="disconnect-wallet"
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={handleConnect}
              className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-violet-500 transition-colors"
              aria-label="Connect Freighter wallet"
              data-testid="connect-wallet"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </nav>

      {/* Compose Modal */}
      <PostComposeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        publicKey={address}
      />
    </header>
  );
}
