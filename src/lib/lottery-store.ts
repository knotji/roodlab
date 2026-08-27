import { create } from "zustand";
import { persist } from "zustand/middleware";
export function addRecent(items: string[], id: string) {
  return [id, ...items.filter((x) => x !== id)].slice(0, 5);
}
export function toggleFavorite(items: string[], id: string) {
  return items.includes(id) ? items.filter((x) => x !== id) : [...items, id];
}
type LotteryState = {
  selectedLotteryId: string | null;
  recentLotteryIds: string[];
  favoriteLotteryIds: string[];
  algorithmId: string;
  setSelectedLottery: (id: string) => void;
  toggleFavorite: (id: string) => void;
  setAlgorithm: (id: string) => void;
};
export function resolveAlgorithmSelection(
  persistedId: string | undefined,
  explicit: boolean,
  applicationDefault = "balanced-v1",
) {
  return explicit && persistedId ? persistedId : applicationDefault;
}
export const useLotteryStore = create<LotteryState>()(
  persist(
    (set) => ({
      selectedLotteryId: null,
      recentLotteryIds: [],
      favoriteLotteryIds: [],
      algorithmId: "balanced-v1",
      setSelectedLottery: (id) =>
        set((s) => ({
          selectedLotteryId: id,
          recentLotteryIds: addRecent(s.recentLotteryIds, id),
        })),
      toggleFavorite: (id) =>
        set((s) => ({
          favoriteLotteryIds: toggleFavorite(s.favoriteLotteryIds, id),
        })),
      setAlgorithm: (id) => set({ algorithmId: id }),
    }),
    { name: "roodlab-lottery-store", skipHydration: true },
  ),
);
export function resolveLotteryId(
  ids: string[],
  stored: string | null,
  url: string | null,
) {
  if (url && ids.includes(url)) return url;
  if (stored && ids.includes(stored)) return stored;
  return ids[0] ?? null;
}
