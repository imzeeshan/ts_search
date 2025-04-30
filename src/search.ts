// Make sure this is at the top of the file
import 'dotenv/config';
import { search } from './utils/supabase/actions/search';

// Export the search function as the main entry point
export { search };

// If you want to run this directly, you can add:
console.log('TS Search initialized. Import the search function to use it.');