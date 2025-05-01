# TS Search

A TypeScript-based CLI tool for searching educational content across multiple platforms including PBS Learning Media and CK-12.

## Features

- Search across multiple educational content providers:
  - PBS Learning Media
  - CK-12
- Content types supported:
  - Videos
  - Interactive Lessons
  - Articles
  - Quizzes
  - Worksheets
- Persistent storage of search results using Supabase
- Command-line interface for easy searching
- Pagination support for search results
- Automatic content type detection and categorization

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

## Configuration
1. Create a .env file in the root directory with the following variables:
```SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_AUTH_EMAIL=your_auth_email
SUPABASE_AUTH_PASSWORD=your_auth_password
nstall
```

## Usage
npm run build
npm run search "your search query"

The results will be returned in JSON format with the following information:

- Title
- Description
- Image URL (if available)
- Content Type (Video, Interactive Lesson, Article, etc.)
- Source (PBS Learning Media or CK-12)
- Direct link to the content

## Database Schema
The project uses Supabase with the following schema for storing search results:

- search_results table:
  - id : UUID (Primary Key)
  - title : Text (Not Null)
  - description : Text
  - image_url : Text
  - link : Text (Not Null)
  - type : Enum (Video, Game, Interactive Lesson, Worksheet, Article, Quiz, Assessment)
  - source : Enum (PBLearning, Khan Academy, CK12, IXL, Other)
  - grade_level : Text
  - user_id : UUID (Foreign Key to auth.users)
  - created_at : Timestamp
  - updated_at : Timestamp

## Import as a Module
import { search } from 'ts_search';

const formData = new FormData();
formData.append('searchQuery', 'your search query');
formData.append('page', '1');
formData.append('pageSize', '10');

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

## Author
Zeeshan Chawdhary

## License
ISC