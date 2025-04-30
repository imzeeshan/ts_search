"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.search = void 0;
// Make sure this is at the top of the file
require("dotenv/config");
const search_1 = require("./utils/supabase/actions/search");
Object.defineProperty(exports, "search", { enumerable: true, get: function () { return search_1.search; } });
// If you want to run this directly, you can add:
console.log('TS Search initialized. Import the search function to use it.');
