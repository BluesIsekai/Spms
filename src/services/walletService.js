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

function makeChannelName(base, userId) {
    return `${base}-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Fetch or initialize the paper trading wallet for a user.
 */
export async function fetchWallet(userId) {
    const resolvedUserId = await requireAuthUserId(userId);
    const { data, error } = await supabase.from("paper_wallet").select("*").eq("user_id", resolvedUserId).single();

    if (error) {
        if (error.code === "PGRST116") {
            // Wallet not found, create default
            return initializeWallet(resolvedUserId);
        }
        throw error;
    }
    return data;
}

/**
 * Initialize a default paper wallet with 1,00,000 INR
 */
export async function initializeWallet(userId, balance = 10000000.0) {
    const resolvedUserId = await requireAuthUserId(userId);
    const { data, error } = await supabase
        .from("paper_wallet")
        .insert({
            user_id: resolvedUserId,
            virtual_balance: balance,
            initial_balance: balance,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateWalletBalance(userId, balance) {
    const resolvedUserId = await requireAuthUserId(userId);
    const nextBalance = Number(balance);
    if (!Number.isFinite(nextBalance) || nextBalance < 0) {
        throw new Error("Balance must be a valid non-negative number.");
    }

    const { data, error } = await supabase
        .from("paper_wallet")
        .upsert(
            {
                user_id: resolvedUserId,
                virtual_balance: nextBalance,
            },
            { onConflict: "user_id" },
        )
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Subscribe to realtime wallet changes.
 */
export function subscribeWallet(userId, callback) {
    requireSupabase();
    const channel = supabase
        .channel(makeChannelName("wallet-changes", userId))
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "paper_wallet", filter: `user_id=eq.${userId}` },
            callback,
        )
        .subscribe();
    return () => supabase.removeChannel(channel);
}
