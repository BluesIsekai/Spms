import { supabase } from "./supabaseClient";

function requireSupabase() {
    return !!supabase;
}

async function requireAuthUserId(expectedUserId = null) {
    if (!requireSupabase()) throw new Error("Supabase is not configured.");
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    const authUserId = data?.user?.id;
    if (!authUserId) throw new Error("You must be signed in to perform this action.");
    if (expectedUserId && expectedUserId !== authUserId) {
        throw new Error("Authenticated user mismatch. Please refresh and try again.");
    }
    return authUserId;
}

export function inferAssetTypeFromSymbol(symbol = "") {
    const value = String(symbol || "")
        .trim()
        .toUpperCase();
    if (!value) return "EQUITY";
    if (value.includes("_MF")) return "MUTUAL_FUND";
    if (value.startsWith("^")) return "INDEX";
    if (value.includes("=F") || ["CL=F", "GC=F", "SI=F", "NG=F", "NQ=F", "ES=F", "YM=F", "RTY=F"].includes(value))
        return "FNO";
    if (value.includes("-USD")) return "CRYPTO";
    if (value.includes("ETF")) return "ETF";
    return "EQUITY";
}

export async function fetchRecentViews(userId, { limit = 7, assetTypes = [] } = {}) {
    if (!requireSupabase()) return [];
    const resolvedUserId = await requireAuthUserId(userId);

    let query = supabase
        .from("user_recent_views")
        .select("*")
        .eq("user_id", resolvedUserId)
        .order("last_viewed_at", { ascending: false })
        .limit(limit);

    if (Array.isArray(assetTypes) && assetTypes.length > 0) {
        query = query.in("asset_type", assetTypes);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

export async function recordRecentView(userId, symbol, { yahooSymbol, companyName, assetType, sourcePage } = {}) {
    if (!requireSupabase() || !symbol) return null;
    const resolvedUserId = await requireAuthUserId(userId);

    const resolvedYahooSymbol = yahooSymbol || symbol;
    const resolvedAssetType = assetType || inferAssetTypeFromSymbol(resolvedYahooSymbol);
    const payload = {
        user_id: resolvedUserId,
        symbol,
        yahoo_symbol: resolvedYahooSymbol,
        company_name: companyName || symbol,
        asset_type: resolvedAssetType,
        source_page: sourcePage || null,
        last_viewed_at: new Date().toISOString(),
    };

    const { data: existing, error: existingError } = await supabase
        .from("user_recent_views")
        .select("id, view_count")
        .eq("user_id", resolvedUserId)
        .eq("yahoo_symbol", resolvedYahooSymbol)
        .eq("asset_type", resolvedAssetType)
        .maybeSingle();

    if (existingError && existingError.code !== "PGRST116") throw existingError;

    if (existing?.id) {
        const { data, error } = await supabase
            .from("user_recent_views")
            .update({
                ...payload,
                view_count: Number(existing.view_count || 0) + 1,
            })
            .eq("id", existing.id)
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    const { data, error } = await supabase
        .from("user_recent_views")
        .insert({
            ...payload,
            view_count: 1,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function fetchMutualFundSips(userId) {
    if (!requireSupabase()) return [];
    const resolvedUserId = await requireAuthUserId(userId);

    const { data, error } = await supabase
        .from("user_mutual_fund_sips")
        .select("*")
        .eq("user_id", resolvedUserId)
        .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
}

export async function upsertMutualFundSip({
    userId,
    schemeCode,
    schemeName,
    category,
    amount,
    deductionDay,
    status = "Active",
    nextPaymentAt = null,
}) {
    if (!requireSupabase() || !schemeCode) return null;
    const resolvedUserId = await requireAuthUserId(userId);

    const { data, error } = await supabase
        .from("user_mutual_fund_sips")
        .upsert(
            {
                user_id: resolvedUserId,
                scheme_code: schemeCode,
                scheme_name: schemeName,
                category: category || null,
                amount: Number(amount),
                deduction_day: Number(deductionDay),
                status,
                next_payment_at: nextPaymentAt,
                updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,scheme_code,deduction_day" },
        )
        .select()
        .single();

    if (error) throw error;
    return data;
}
