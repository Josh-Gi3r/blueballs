/** The screen registry — the shared surface for the phone-screen journey. */
import type { ComponentType } from "react";
import Signup, { meta as SignupMeta } from "./signup";
import KycProcessing, { meta as KycProcessingMeta } from "./kyc-processing";
import KycApproved, { meta as KycApprovedMeta } from "./kyc-approved";
import AccountOpen, { meta as AccountOpenMeta } from "./account-open";
import TierLimits, { meta as TierLimitsMeta } from "./tier-limits";
import ReceivingDetails, { meta as ReceivingDetailsMeta } from "./receiving-details";
import DepositRails, { meta as DepositRailsMeta } from "./deposit-rails";
import DepositOnchain, { meta as DepositOnchainMeta } from "./deposit-onchain";
import DepositPending, { meta as DepositPendingMeta } from "./deposit-pending";
import FundedHome, { meta as FundedHomeMeta } from "./funded-home";
import CardIssued, { meta as CardIssuedMeta } from "./card-issued";
import CardControls, { meta as CardControlsMeta } from "./card-controls";
import CardTap, { meta as CardTapMeta } from "./card-tap";
import CardDeclined, { meta as CardDeclinedMeta } from "./card-declined";
import LinkExternal, { meta as LinkExternalMeta } from "./link-external";
import PayoutReceipt, { meta as PayoutReceiptMeta } from "./payout-receipt";
import MerchantQr, { meta as MerchantQrMeta } from "./merchant-qr";
import WalletProduct, { meta as WalletProductMeta } from "./wallet-product";

export type ScreenMeta = {
  id: string;
  journey: "onboarding" | "funding" | "spending" | "payout" | "product";
  title: string;
  blurb: string;
  endpoint: string;
  code: string;
  live?: boolean;
};

export type ScreenModule = { meta: ScreenMeta; Component: ComponentType<any> };

export const JOURNEYS: { id: ScreenMeta["journey"]; label: string; blurb: string }[] = [
  { id: "onboarding", label: "Onboarding", blurb: "Create a customer, move through verification and open an account." },
  { id: "funding", label: "Funding", blurb: "Show customers how to add money through a configured payment rail or wallet." },
  { id: "spending", label: "Spending", blurb: "Issue a card, apply controls and show the resulting authorisation decision." },
  { id: "payout", label: "Payout", blurb: "Create a recipient and destination, then follow a transfer through to settlement." },
  { id: "product", label: "More products", blurb: "See additional customer experiences powered by the Blueballs API." },
];

export const SCREENS: ScreenModule[] = [
  { meta: SignupMeta, Component: Signup },
  { meta: KycProcessingMeta, Component: KycProcessing },
  { meta: KycApprovedMeta, Component: KycApproved },
  { meta: AccountOpenMeta, Component: AccountOpen },
  { meta: TierLimitsMeta, Component: TierLimits },
  { meta: ReceivingDetailsMeta, Component: ReceivingDetails },
  { meta: DepositRailsMeta, Component: DepositRails },
  { meta: DepositOnchainMeta, Component: DepositOnchain },
  { meta: DepositPendingMeta, Component: DepositPending },
  { meta: FundedHomeMeta, Component: FundedHome },
  { meta: CardIssuedMeta, Component: CardIssued },
  { meta: CardControlsMeta, Component: CardControls },
  { meta: CardTapMeta, Component: CardTap },
  { meta: CardDeclinedMeta, Component: CardDeclined },
  { meta: LinkExternalMeta, Component: LinkExternal },
  { meta: PayoutReceiptMeta, Component: PayoutReceipt },
  { meta: MerchantQrMeta, Component: MerchantQr },
  { meta: WalletProductMeta, Component: WalletProduct },
];

export const byJourney = (j: ScreenMeta["journey"]) => SCREENS.filter((s) => s.meta.journey === j);
export const screenById = (id: string) => SCREENS.find((s) => s.meta.id === id);
