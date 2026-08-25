import contracts from "./screen-contracts.generated.json";

export type ScreenContract = (typeof contracts)[number];

export const SCREEN_CONTRACTS: readonly ScreenContract[] = contracts;

export function getScreenContract(screenId: string): ScreenContract | undefined {
  return SCREEN_CONTRACTS.find((contract) => contract.id === screenId);
}
