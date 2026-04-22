import { supabase } from "./supabaseClient";

function requireSupabase() {
    if (!supabase) throw new Error("Supabase is not configured.");
}

async function requireAuthUserId(expectedUserId = null) {
    requireSupabase();
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    const authUserId = data?.user?.id;
    if (!authUserId) throw new Error("You must be signed in to perform this action.");
    if (expectedUserId && expectedUserId !== authUserId) {
        throw new Error("Authenticated user mismatch. Please refresh and try again.");
    }
    return authUserId;
}

/**
 * Fetch user settings, create default if missing.
 */
export async function fetchSettings(userId) {
    const resolvedUserId = await requireAuthUserId(userId);
    const { data, error } = await supabase.from("user_settings").select("*").eq("user_id", resolvedUserId).single();

    if (error) {
        if (error.code === "PGRST116") {
            return updateSettings(resolvedUserId, {
                theme: "dark",
                currency: "INR",
                refresh_interval: 10000,
                default_balance: 100000,
                notifications: true,
            });
        }
        throw error;
    }
    return data;
}

/**
 * Update user settings.
 */
export async function updateSettings(userId, updates) {
    const resolvedUserId = await requireAuthUserId(userId);
    const payload = { user_id: resolvedUserId, ...updates };
    const { data, error } = await supabase
        .from("user_settings")
        .upsert(payload, { onConflict: "user_id" })
        .select()
        .single();

    if (error) throw error;
    return data;
}
