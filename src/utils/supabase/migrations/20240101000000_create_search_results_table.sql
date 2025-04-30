-- Create enum types for content type and source
create type content_type as enum (
  'Video',
  'Game',
  'Interactive Lesson',
  'Worksheet',
  'Article',
  'Quiz',
  'Assessment'
);

create type content_source as enum (
  'PBLearning',
  'Khan Academy',
  'CK12',
  'IXL',
  'Other'
);

-- Create search_results table
create table search_results (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  image_url text,
  link text not null,
  type content_type not null,
  source content_source not null,
  grade_level text,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(title, source, user_id)
);

-- Add text search vector column
alter table search_results add column search_vector tsvector generated always as (
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'B')
) stored;

-- Create GIN index for full text search
create index search_results_search_idx on search_results using gin(search_vector);

-- Create indexes for frequently queried fields
create index search_results_user_id_idx on search_results(user_id);
create index search_results_type_idx on search_results(type);
create index search_results_source_idx on search_results(source);

-- Enable Row Level Security (RLS)
alter table search_results enable row level security;

-- Create policy to allow users to view their own search results
create policy "Users can view their own search results"
  on search_results for select
  using (auth.uid() = user_id);

-- Create policy to allow authenticated users to insert search results
create policy "Users can insert their own search results"
  on search_results for insert
  with check (auth.uid() = user_id);

-- Create updated_at trigger
create or replace function update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create trigger update_search_results_updated_at
  before update
  on search_results
  for each row
  execute function update_updated_at_column();