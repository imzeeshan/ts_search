import { createClient } from '@supabase/supabase-js';
import { Database } from '../../../database.types';
import { chromium } from 'playwright';

// Check if environment variables are set
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// Default pagination values
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;

type SearchResult = {
  id: string;
  title: string;
  description: string;
  image: string;
  type: string;
  source: string;
  url: string;
  grade_level?: string;
  created_at: string;
};

type PaginationType = {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

type SearchState = {
  results: SearchResult[];
  groupedResults?: { source: string; items: SearchResult[]; count: number }[];
  pagination: PaginationType;
  pending?: boolean;
};

type SourceType = 'PBLearning' | 'Khan Academy' | 'CK12' | 'IXL' | 'Other';

type ContentType = 'Video' | 'Game' | 'Interactive Lesson' | 'Worksheet' | 'Article' | 'Quiz' | 'Assessment';

type DatabaseResult = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  type: ContentType;  // Update to use the strict ContentType
  source: SourceType;
  link: string;
  user_id: string;
  created_at: string;
};

type KhanAcademyResult = {
  title: string;
  description: string;
  image_url: string;
  link: string;
  type: string;
  source: string;
};


type SupabaseClient = {
  from: (table: string) => {
    select: (columns: string, options?: { count: 'exact' }) => SupabaseQuery;
    insert: (data: Partial<DatabaseResult>[]) => Promise<{ data: DatabaseResult[] | null; error: Error | null }>;
  };
  auth: {
    getUser: () => Promise<{ data: { user: { id: string } | null }, error: Error | null }>;
    signInWithPassword: (credentials: { 
      email: string; 
      password: string 
    }) => Promise<{ 
      data: { user: { id: string } }, 
      error: Error | null 
    }>;
  };
};

type SupabaseQuery = {
  eq: (column: string, value: string) => SupabaseQuery;
  or: (conditions: string) => SupabaseQuery;
  order: (column: string, options: { ascending: boolean }) => SupabaseQuery;
  range: (from: number, to: number) => SupabaseQuery;
  then: <T>(onfulfilled: ((value: { data: DatabaseResult[]; error: Error | null; count: number | null }) => T | PromiseLike<T>) | null) => Promise<T>;
  single: () => Promise<{ data: DatabaseResult | null; error: Error | null }>;
};


async function searchPBS(query: string) {
  try {
    const response = await fetch(
      'https://www.pbslearningmedia.org/api/v2/search/?rank_by=recency&q='+query+'&start=0&facet_by=accessibility,additional_features,cp,cs,ct,grades,subject,language,media_type,duration'
    );
    const data = await response.json();

    type PBSMediaItem = {
      media_type?: string[];
      title: string;
      description?: string;
      poster_images?: { url: string }[];
      canonical_url: string;
    };

    type PBSSearchResult = {
      title: string;
      description: string;
      image_url: string;
      link: string;
      type: string;
      source: string;
    };

    return data.objects.map((item: PBSMediaItem) => {
      let contentType = 'Article';
      if (item.media_type?.[0]?.toLowerCase().includes('video')) {
        contentType = 'Video';
      } else if (item.media_type?.[0]?.toLowerCase().includes('interactive')) {
        contentType = 'Interactive Lesson';
      } else if (item.media_type?.[0]?.toLowerCase().includes('quiz')) {
        contentType = 'Quiz';
      }

      return {
        title: item.title,
        description: item.description?.replace(/(<([^>]+)>)/gi, '') || '',
        image_url: item.poster_images?.[0]?.url || '',
        link: item.canonical_url,
        type: contentType,
        source: 'PBLearning'
      } as PBSSearchResult;
    });
  } catch (error) {
    console.error('PBS search error:', error);
    return [];
  }
}

async function searchCK12(query: string) {
  try {
    const response = await fetch(
      'https://api-prod.ck12.org/flx/search/direct/modality?q='+query+'&pageNum=1&specialSearch=false&filters=false&ck12only=true&pageSize=10&includeEIDs=1&includeSpecialMatches=true&expirationAge=hourly'
    );

    // Check if response is ok
    if (!response.ok) {
      console.error('CK12 API error:', response.status, response.statusText);
      const text = await response.text();
      console.error('Response text:', text);
      return [];
    }

    const data = await response.json();
    const results = data?.response?.Artifacts?.result;
    
    if (!results || !Array.isArray(results)) {
      console.error('Invalid CK12 API response format:', data);
      return [];
    }

    type CK12ArtifactType = 'lesson' | 'video' | 'quiz' | 'assessment' | 'worksheet' | 'article';
    
    type CK12Domain = {
      branchInfo?: {
        name: string;
      };
    };
    
    type CK12Item = {
      artifactType: CK12ArtifactType;
      title: string;
      summary?: string;
      coverImage?: string;
      handle?: string;
      domain?: CK12Domain;
    };
    
    type CK12SearchResult = {
      title: string;
      description: string;
      image_url: string;
      link: string;
      type: string;
      source: string;
    };
    
    const transformedResults = Array.isArray(results) ? results
      .filter((item): item is CK12Item => Boolean(item && item.title))
      .map((item: CK12Item): CK12SearchResult => {
        
        // Keep only this contentType declaration which correctly uses CK12 artifactType
        const contentType = item.artifactType === 'lesson'
          ? 'Interactive Lesson'
          : item.artifactType === 'video' || (item.coverImage && item.coverImage.includes('video'))
          ? 'Video'
          : item.artifactType === 'quiz' || item.artifactType === 'assessment'
          ? 'Quiz'
          : item.artifactType === 'worksheet'
          ? 'Worksheet'
          : 'Article';
    
        const description = item.summary || 
          (item.domain?.branchInfo ? `${item.domain.branchInfo.name} - ${item.title}` : '') || 
          '';
    
        const url = item.handle ? 
          `https://www.ck12.org/${item.handle}` : 
          'https://www.ck12.org';
    
        return {
          title: item.title || '',
          description: description,
          image_url: item.coverImage || 'https://placehold.co/400x300?text=No+Image',
          link: url,
          type: contentType,
          source: 'CK12'
        };
      }) : [];

    return transformedResults;
  } catch (error) {
    console.error('CK12 search error:', error);
    return [];
  }
}

async function khanAcademy(query: string): Promise<KhanAcademyResult[]> {
  try {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    const searchUrl = 'https://www.khanacademy.org/search?page_search_query='+query;

    await page.goto(searchUrl, { waitUntil: 'networkidle' });
    await page.waitForSelector('#indexed-search-results > div._xu2jcg > ul', { timeout: 15000 });

    const results: KhanAcademyResult[] = await page.evaluate(() => {
      const items: KhanAcademyResult[] = [];
      const elements = document.querySelectorAll('#indexed-search-results > div._xu2jcg > ul > li');

      elements.forEach((element) => {
        const title = element.querySelector('a > div._pxfwtyj > div._5uggrpt > div._1ufuji7')?.textContent?.trim() || '';
        const link = element.querySelector('a')?.getAttribute('href') || '';
        const typeText = element.querySelector('span')?.textContent?.trim() || ''; // Preserve type detection
        const description = element.querySelector('span._q2j5iam')?.textContent?.trim() || '';

        const type = typeText === 'Video'
          ? 'Video'
          : typeText === 'Article'
          ? 'Article'
          : typeText === 'Lesson'
          ? 'Interactive Lesson'
          : 'Article';

        // Update the source value in the khanAcademy function
        items.push({
          title,
          description,
          image_url: 'https://placehold.co/400x300?text=Khan+Academy',
          link: 'https://www.khanacademy.org' + link,
          type,
          source: 'Khan Academy', // Changed from 'KhanAcademy' to 'Khan Academy'
        });
      });

      return items;
    });

    await browser.close();
    return results;
  } catch (error) {
    console.error('Khan Academy search error:', error);
    return [];
  }
}

async function storeResults(
  results: Array<{
    title: string;
    description?: string;
    image_url?: string;
    link: string;
    type: string;  // Keep this as string since input might need transformation
    source: SourceType;
  }>, 
  userId: string
) {
  for (const result of results) {
    try {
      // Transform the type to match ContentType
      const contentType: ContentType = result.type === 'Video' ? 'Video'
        : result.type === 'Interactive Lesson' ? 'Interactive Lesson'
        : result.type === 'Quiz' ? 'Quiz'
        : result.type === 'Worksheet' ? 'Worksheet'
        : result.type === 'Assessment' ? 'Assessment'
        : result.type === 'Game' ? 'Game'
        : 'Article';  // Default to Article if no match

      const { data: existingData, error: queryError } = await supabase
        .from('search_results')
        .select('*')
        .eq('title', result.title)
        .eq('source', result.source)
        .eq('user_id', userId)
        .single();

      if (queryError || !existingData) {
        const { error } = await supabase
          .from('search_results')
          .insert({
            title: result.title,
            description: result.description || null,
            image_url: result.image_url || null,
            link: result.link,
            type: contentType,  // Use the transformed type
            source: result.source,
            user_id: userId,
            id: crypto.randomUUID(),
            created_at: new Date().toISOString()
          });
          
        if (error) {
          console.error('Error inserting result:', error);
        }
      }
    } catch (error) {
      console.error('Error storing result:', error);
    }
  }
}

async function getStoredResults(
  userId: string,
  page: number,
  pageSize: number,
  searchQuery?: string
): Promise<{ results: SearchResult[]; totalItems: number }> {
  try {
    let query = supabase
      .from('search_results')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    if (searchQuery?.trim()) {
      query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
    }

    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(start, end);

    if (error) {
      console.error('Error fetching stored results:', error);
      return { results: [], totalItems: 0 };
    }

    if (!data) {
      return { results: [], totalItems: 0 };
    }

    const results: SearchResult[] = data.map(item => ({
      id: item.id,
      title: item.title,
      description: item.description || '',
      image: item.image_url || '',
      type: item.type,
      source: item.source,
      url: item.link,
      created_at: item.created_at
    }));

    return {
      results,
      totalItems: count || 0
    };
  } catch (error) {
    console.error('Error in getStoredResults:', error);
    return { results: [], totalItems: 0 };
  }
}

// Group results by source
function groupResultsBySource(results: SearchResult[]) {
  const grouped = results.reduce((acc, result) => {
    const source = result.source;
    if (!acc[source]) {
      acc[source] = [];
    }
    acc[source].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  return Object.entries(grouped).map(([source, items]) => ({
    source,
    items,
    count: items.length
  }));
}

// Use a type assertion in the search function
export async function search(
  prevState: SearchState,
  formData: FormData
): Promise<SearchState> {
  // Sign in with email and password from environment variables
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: process.env.SUPABASE_AUTH_EMAIL || '',
    password: process.env.SUPABASE_AUTH_PASSWORD || ''
  });
  
  if (authError) {
    console.error('Authentication error:', authError);
    throw new Error('Authentication failed');
  }
  
  const userId = authData.user.id;
  
  const searchQuery = formData.get('searchQuery') as string;
  const page = Number(formData.get('page')) || DEFAULT_PAGE;
  const pageSize = Number(formData.get('pageSize')) || DEFAULT_PAGE_SIZE;

  if (searchQuery?.trim()) {
    const [pbsResults, ck12Results] = await Promise.all([
      searchPBS(searchQuery),
      searchCK12(searchQuery),
    ]);

    const combinedResults = [...pbsResults, ...ck12Results].map(result => ({
      ...result,
      description: result.description || '',
      image_url: result.image_url || ''
    }));

    await storeResults(combinedResults, userId);
  }

  // Get stored results after storing new ones
  const { results, totalItems } = await getStoredResults(
    userId,
    page,
    pageSize,
    searchQuery
  );

  const groupedResults = !searchQuery?.trim() ? groupResultsBySource(results) : [];

  return {
    results,
    groupedResults,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalItems / pageSize),
      pageSize,
      totalItems,
      hasNextPage: page < Math.ceil(totalItems / pageSize),
      hasPreviousPage: page > 1
    },
    pending: false
  };
}
