import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { saveProfileRequest } from "../services/saveProfile";
import type { SaveOutcome } from "../types";

type ProfileState = {
  isSaving: boolean;
  saveError: string;
  saveSuccess: boolean;
  savedAt: string;
};

const initialState: ProfileState = {
  isSaving: false,
  saveError: "",
  saveSuccess: false,
  savedAt: "",
};

export const saveProfile = createAsyncThunk<
  { savedAt: string },
  SaveOutcome,
  { rejectValue: string }
>("profile/save", async (outcome, thunkApi) => {
  try {
    return await saveProfileRequest(outcome);
  } catch (error) {
    return thunkApi.rejectWithValue(
      error instanceof Error ? error.message : "Profile save failed",
    );
  }
});

const profileSlice = createSlice({
  name: "profile",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(saveProfile.pending, (state) => {
        state.isSaving = true;
        state.saveError = "";
        state.saveSuccess = false;
        state.savedAt = "";
      })
      .addCase(saveProfile.fulfilled, (state, action) => {
        state.isSaving = false;
        state.saveSuccess = true;
        state.savedAt = action.payload.savedAt;
      })
      .addCase(saveProfile.rejected, (state, action) => {
        state.isSaving = false;
        state.saveSuccess = false;
        state.saveError = action.payload ?? "Profile save failed";
      });
  },
});

export const profileReducer = profileSlice.reducer;
