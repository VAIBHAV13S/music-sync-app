import { useState } from 'react';

interface SearchResult {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: string;
  description: string;
}

interface YouTubeSearchProps {
  onSelectTrack: (videoId: string) => void;
}

// YouTube API service
class YouTubeAPIService {
  private static get API_KEY() {
    return import.meta.env.VITE_YOUTUBE_API_KEY || '';
  }
  
  private static get BASE_URL() {
    return 'https://www.googleapis.com/youtube/v3';
  }

  static async searchVideos(query: string, maxResults: number = 10): Promise<SearchResult[]> {
    console.log('API Key available:', !!this.API_KEY);
    
    if (!this.API_KEY) {
      console.error('YouTube API key not found!');
      return [];
    }

    try {
      console.log('Searching for:', query);
      
      // Search for videos
      const searchUrl = `${this.BASE_URL}/search?` +
        `part=snippet&` +
        `q=${encodeURIComponent(query + ' music')}&` +
        `type=video&` +
        `videoCategoryId=10&` + // Music category
        `maxResults=${maxResults}&` +
        `key=${this.API_KEY}`;
        
      console.log('Search URL:', searchUrl);

      const searchResponse = await fetch(searchUrl);

      if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        console.error('Search failed:', searchResponse.status, errorText);
        throw new Error(`Search failed: ${searchResponse.status}`);
      }

      const searchData = await searchResponse.json();
      console.log('Search data:', searchData);
      
      if (!searchData.items || searchData.items.length === 0) {
        console.log('No items found in search');
        return [];
      }

      const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',');
      console.log('Video IDs:', videoIds);

      // Get video details including duration
      const detailsResponse = await fetch(
        `${this.BASE_URL}/videos?` +
        `part=contentDetails,snippet&` +
        `id=${videoIds}&` +
        `key=${this.API_KEY}`
      );

      if (!detailsResponse.ok) {
        throw new Error(`Details failed: ${detailsResponse.status}`);
      }

      const detailsData = await detailsResponse.json();
      console.log('Details data:', detailsData);

      // Process and format results
      const results = detailsData.items.map((item: any) => ({
        id: item.id,
        title: item.snippet.title,
        artist: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
        duration: this.formatDuration(item.contentDetails.duration),
        description: item.snippet.description
      }));
      
      console.log('Processed results:', results);
      return results;

    } catch (error) {
      console.error('YouTube API Error:', error);
      return [];
    }
  }

  // Convert ISO 8601 duration to readable format
  private static formatDuration(duration: string): string {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return '0:00';

    const hours = parseInt(match[1]?.replace('H', '') || '0');
    const minutes = parseInt(match[2]?.replace('M', '') || '0');
    const seconds = parseInt(match[3]?.replace('S', '') || '0');

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

function YouTubeSearch({ onSelectTrack }: YouTubeSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    
    try {
      const searchResults = await YouTubeAPIService.searchVideos(query);
      setResults(searchResults);
      
      if (searchResults.length === 0) {
        setError('No results found. Try different search terms.');
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('Search failed. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const truncateTitle = (title: string, maxLength: number = 60) => {
    return title.length > maxLength ? title.substring(0, maxLength) + '...' : title;
  };

  const truncateArtist = (artist: string, maxLength: number = 30) => {
    return artist.length > maxLength ? artist.substring(0, maxLength) + '...' : artist;
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Search for songs, artists, or albums..."
          className="block w-full pl-10 pr-20 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          disabled={isLoading}
        />
        <div className="absolute inset-y-0 right-0 flex items-center">
          <button
            onClick={handleSearch}
            disabled={!query.trim() || isLoading}
            className="mr-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {isLoading ? (
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              'Search'
            )}
          </button>
        </div>
      </div>

      {/* API Status */}
      {import.meta.env.DEV && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-blue-800">
              YouTube API: {import.meta.env.VITE_YOUTUBE_API_KEY ? '✅ Connected' : '❌ Not configured'}
            </p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-sm text-gray-600">Searching YouTube...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Search Results */}
      {results.length > 0 && !isLoading && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600 px-1">
            Found {results.length} result{results.length !== 1 ? 's' : ''} for "<span className="font-medium">{query}</span>"
          </p>
          <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
            {results.map((track, index) => (
              <div
                key={track.id}
                onClick={() => onSelectTrack(track.id)}
                className={`flex items-center gap-3 p-3 cursor-pointer transition-colors hover:bg-gray-50 group ${
                  index !== results.length - 1 ? 'border-b border-gray-100' : ''
                }`}
              >
                <div className="flex-shrink-0">
                  <img
                    src={track.thumbnail}
                    alt={track.title}
                    className="w-12 h-12 rounded-lg object-cover bg-gray-200"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yNCAxNkM5LjY2IDE2IDIxLjkgMjEuOSAyMiAyMkMyMi4xIDIyLjEgMjQgMjYgMjQgMjZTMjUuOSAyMi4xIDI2IDIyQzI2LjEgMjEuOSAzOC4zNCAyNCA1MiAxNlY2SDBWMzJIMjRWMTZaIiBmaWxsPSIjOUM5Q0FBIi8+Cjwvc3ZnPgo=';
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600">
                    {truncateTitle(track.title)}
                  </h4>
                  <p className="text-xs text-gray-500 truncate">{truncateArtist(track.artist)}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-gray-400 font-mono">{track.duration}</span>
                  <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors opacity-0 group-hover:opacity-100">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h8m2-10a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Results */}
      {query && results.length === 0 && !isLoading && !error && (
        <div className="text-center py-8">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V7a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-500 mb-2">No music found for "<span className="font-medium">{query}</span>"</p>
          <p className="text-sm text-gray-400">Try different search terms or check your spelling</p>
        </div>
      )}
    </div>
  );
}

export default YouTubeSearch;
