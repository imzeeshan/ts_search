// Make sure this is at the top of the file
import 'dotenv/config';
import { search } from './utils/supabase/actions/search';

// Simple CLI to search and return JSON results
async function runSearch() {
  const query = process.argv.slice(2).join(' ') || '';
  
  if (!query) {
    console.log(JSON.stringify({ error: 'No search query provided', usage: 'npm run search <query>' }));
    return;
  }
  
  const formData = new FormData();
  formData.append('searchQuery', query);
  formData.append('page', '1');
  formData.append('pageSize', '10');
  
  try {
    const results = await search({
      results: [],
      pagination: {
        currentPage: 1,
        totalPages: 1,
        pageSize: 10,
        totalItems: 0,
        hasNextPage: false,
        hasPreviousPage: false
      }
    }, formData);
    
    // Output results as JSON
    console.log(JSON.stringify(results));
  } catch (error) {
    console.error(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }));
  }
}

runSearch();