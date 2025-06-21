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

// YouTube API service - NOW CALLS OUR BACKEND
class YouTubeAPIService {
  private static get BASE_URL() {
    return import.meta.env.VITE_SOCKET_SERVER_URL || '';
  }

  static async searchVideos(query: string): Promise<SearchResult[]> {
    if (!this.BASE_URL) {
      throw new Error("VITE_SOCKET_SERVER_URL is not defined in the environment variables.");
    }

    try {
      const response = await fetch(`${this.BASE_URL}/api/search?q=${encodeURIComponent(query)}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch search results from server.');
      }

      const data = await response.json();

      // The backend now returns the fully formatted SearchResult[], so we just need to format the duration
      return data.map((item: any) => ({
        ...item,
        duration: this.formatDuration(item.duration),
      }));

    } catch (error) {
      console.error('Error searching videos:', error);
      throw error; // Re-throw to be caught by the component
    }
  }

  private static formatDuration(duration: string): string {
    // Convert ISO 8601 duration (PT4M20S) to readable format (4:20)
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return "0:00";

    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }
}

function YouTubeSearch({ onSelectTrack }: YouTubeSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const searchResults = await YouTubeAPIService.searchVideos(query);
      setResults(searchResults);
      
      if (searchResults.length === 0) {
        setError('No music found for your search. Try different keywords.');
      }
    } catch (err) {
      setError('Failed to search YouTube. Please try again.');
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const truncateTitle = (title: string, maxLength: number = 50) => {
    return title.length > maxLength ? title.substring(0, maxLength) + '...' : title;
  };

  return (
    <div className="w-full max-w-4xl mx-auto mb-6">
      {/* Search Bar */}
      <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6 mb-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Search for songs, artists, or albums..."
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              🔍
            </div>
          </div>
          <button
            onClick={handleSearch}
            disabled={!query.trim() || isLoading}
            className="px-6 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 text-white rounded-xl font-medium transition-colors"
          >
            {isLoading ? '🔄' : 'Search'}
          </button>
        </div>
        
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-8">
          <div className="text-4xl mb-4 animate-spin">🔄</div>
          <p className="text-gray-400">Searching YouTube Music...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-2xl p-6 mb-4">
          <div className="text-center">
            <div className="text-4xl mb-4">❌</div>
            <p className="text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* Search Results */}
      {results.length > 0 && !isLoading && (
        <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-4">
            🎵 Found {results.length} results for "{query}"
          </h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {results.map((track) => (
              <div
                key={track.id}
                onClick={() => onSelectTrack(track.id)}
                className="flex items-center gap-4 p-3 bg-gray-800/30 hover:bg-gray-800/50 rounded-xl cursor-pointer transition-all duration-200 hover:scale-[1.02] group"
              >
                <img
                  src={track.thumbnail}
                  alt={track.title}
                  className="w-16 h-16 rounded-lg object-cover"
                  onError={(e) => {
                    e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjMzc0MTUxIi8+Cjx0ZXh0IHg9IjMyIiB5PSIzMiIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjI0IiBmaWxsPSIjOUM5Q0FBIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iMC4zZW0iPvCfjonCeS90ZXh0Pgo8L3N2Zz4K';
                  }}
                />
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-medium truncate group-hover:text-purple-300 transition-colors">
                    {truncateTitle(track.title)}
                  </h4>
                  <p className="text-gray-400 text-sm truncate">{track.artist}</p>
                </div>
                <div className="text-gray-400 text-sm font-mono">
                  {track.duration}
                </div>
                <button className="p-2 text-purple-400 hover:text-purple-300 transition-colors opacity-0 group-hover:opacity-100">
                  ▶️
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Results */}
      {query && results.length === 0 && !isLoading && !error && (
        <div className="text-center py-8">
          <div className="text-4xl mb-4">😔</div>
          <p className="text-gray-400">No music found for "{query}"</p>
          <p className="text-gray-500 text-sm mt-2">Try searching for different keywords</p>
        </div>
      )}
    </div>
  );
}

export default YouTubeSearch;