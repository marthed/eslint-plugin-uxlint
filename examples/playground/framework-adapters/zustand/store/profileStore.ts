import { create } from "zustand";
import { saveProfileRequest } from "../services/saveProfile";
import type { SaveOutcome } from "../types";

type ProfileStore = {
  isSaving: boolean;
  saveError: string;
  isSuccess: boolean;
  savedAt: string;
  saveProfile: (outcome: SaveOutcome) => Promise<void>;
  resetProfileState: () => void;
};

function createProfileStore() {
  return create<ProfileStore>((set) => ({
    isSaving: false,
    saveError: "",
    isSuccess: false,
    savedAt: "",
    async saveProfile(outcome) {
      set({
        isSaving: true,
        saveError: "",
        isSuccess: false,
        savedAt: "",
      });

      try {
        const result = await saveProfileRequest(outcome);
        set({
          isSuccess: true,
          savedAt: result.savedAt,
        });
      } catch (error) {
        set({
          saveError:
            error instanceof Error ? error.message : "Profile save failed",
        });
      } finally {
        set({ isSaving: false });
      }
    },
    resetProfileState() {
      set({
        isSaving: false,
        saveError: "",
        isSuccess: false,
        savedAt: "",
      });
    },
  }));
}

export const useBadProfileStore = createProfileStore();
export const useGoodProfileStore = createProfileStore();
