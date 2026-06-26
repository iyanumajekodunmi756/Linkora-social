"use client";

import { useWallet } from "@/hooks/useWallet";
import { ProfileSection } from "@/components/settings/ProfileSection";
import { WalletSection } from "@/components/settings/WalletSection";
import { DmKeySection } from "@/components/settings/DmKeySection";
import { NotificationsSection } from "@/components/settings/NotificationsSection";
import { BlockListSection } from "@/components/settings/BlockListSection";
import { GovernanceSection } from "@/components/settings/GovernanceSection";
import { DangerZoneSection } from "@/components/settings/DangerZoneSection";
import { ThemeSection } from "@/components/settings/ThemeSection";

export default function SettingsPage() {
  const { address, connected } = useWallet();

  if (!connected || !address) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <p className="text-gray-600">Connect your wallet to access settings.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      <div className="space-y-8">
        {/* Appearance Section */}
        <ThemeSection />

        {/* Profile Section */}
        <ProfileSection address={address} />

        {/* Wallet Section */}
        <WalletSection />

        {/* DM Key Section */}
        <DmKeySection address={address} />

        {/* Notifications Section */}
        <NotificationsSection />

        {/* Block List Section */}
        <BlockListSection address={address} />

        {/* Governance Section */}
        <GovernanceSection address={address} />

        {/* Danger Zone Section */}
        <DangerZoneSection address={address} />
      </div>
    </div>
  );
}
