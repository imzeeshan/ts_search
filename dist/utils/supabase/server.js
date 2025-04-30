"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createClient = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const createClient = () => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase environment variables');
    }
    return (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
};
exports.createClient = createClient;
