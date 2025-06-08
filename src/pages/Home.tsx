import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Home() {
  const navigate = useNavigate();
  const [quickJoinCode, setQuickJoinCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  const handleQuickJoin = async () => {
    if (!quickJoinCode.trim()) return;
    
    setIsJoining(true);
    
    try {
      // Check if room exists before navigating
      const response = await fetch(`${import.meta.env.VITE_SOCKET_SERVER_URL}/api/rooms/${quickJoinCode}`);
      
      if (response.ok) {
        navigate(`/join/group?room=${quickJoinCode.toUpperCase()}`);
      } else {
        alert('Room not found. Please check the room code.');
      }
    } catch (error) {
      console.error('Error checking room:', error);
      // Navigate anyway for demo purposes
      navigate(`/join/group?room=${quickJoinCode.toUpperCase()}`);
    } finally {
      setIsJoining(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleQuickJoin();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-900 text-white relative overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 via-blue-600/5 to-indigo-600/5"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.1),rgba(255,255,255,0))]"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl animate-pulse delay-2000"></div>
      </div>
      
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="text-center pt-20 pb-16">
          <div className="mb-8">
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-black bg-gradient-to-r from-white via-blue-100 to-purple-200 bg-clip-text text-transparent leading-tight mb-6 tracking-tight">
              Music Sync
            </h1>
            <div className="flex items-center justify-center gap-2 mb-8">
              <div className="h-px bg-gradient-to-r from-transparent via-gray-500 to-transparent flex-1 max-w-xs"></div>
              <span className="text-xl text-gray-400 font-light px-4">Listen Together</span>
              <div className="h-px bg-gradient-to-r from-transparent via-gray-500 to-transparent flex-1 max-w-xs"></div>
            </div>
          </div>
          <p className="text-2xl text-gray-300 font-light max-w-3xl mx-auto px-6 leading-relaxed">
            Experience music in perfect harmony with friends across the globe. 
            <br className="hidden sm:block" />
            Real-time synchronization, zero latency, infinite possibilities.
          </p>
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-6xl mx-auto px-6 pb-20">
          
          {/* Quick Join Section */}
          <div className="mb-20">
            <div className="bg-gray-900/40 backdrop-blur-2xl border border-gray-700/50 rounded-3xl p-10 max-w-2xl mx-auto shadow-2xl hover:shadow-3xl transition-all duration-500">
              <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
                  <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-200 mb-3">Quick Join</h2>
                <p className="text-gray-400">Have a room code? Jump right in!</p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={quickJoinCode}
                    onChange={(e) => setQuickJoinCode(e.target.value.toUpperCase())}
                    onKeyPress={handleKeyPress}
                    placeholder="Enter room code (e.g. ABCD12)"
                    maxLength={6}
                    className="w-full px-6 py-4 bg-gray-800/50 border border-gray-600/50 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-center text-xl font-mono tracking-[0.2em] transition-all duration-200 hover:bg-gray-800/70 hover:border-gray-500/50"
                  />
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-blue-500/0 pointer-events-none"></div>
                </div>
                
                <button 
                  onClick={handleQuickJoin}
                  disabled={!quickJoinCode.trim() || isJoining}
                  className="px-8 py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-2xl font-bold text-lg transition-all duration-200 transform hover:scale-105 disabled:transform-none shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 flex items-center justify-center gap-3 min-w-fit"
                >
                  {isJoining ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span className="hidden sm:inline">Joining...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                      </svg>
                      <span className="hidden sm:inline">Join Session</span>
                      <span className="sm:hidden">Join</span>
                    </>
                  )}
                </button>
              </div>

              {/* Quick Join Hints */}
              <div className="mt-6 pt-6 border-t border-gray-700/50">
                <div className="flex flex-wrap justify-center gap-6 text-xs text-gray-500">
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                    Instant access
                  </span>
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                    Auto-sync
                  </span>
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                    HD quality
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Mode Selection */}
          <div className="mb-20">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">Choose Your Experience</h2>
              <p className="text-xl text-gray-400">Create your own session or join an existing one</p>
            </div>

            <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
              
              {/* Host Option */}
              <div className="group bg-gray-900/40 backdrop-blur-2xl border border-gray-700/50 rounded-3xl p-10 hover:bg-gray-900/60 hover:border-gray-600/50 transition-all duration-500 hover:shadow-2xl hover:scale-105">
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto mb-8 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                  <h3 className="text-3xl font-bold mb-6 text-white group-hover:text-purple-200 transition-colors">Host a Session</h3>
                  <p className="text-gray-300 mb-10 leading-relaxed text-lg">
                    Take control and lead the musical journey. Choose what plays, when it plays, and create unforgettable shared experiences with your friends.
                  </p>
                  
                  {/* Host Features */}
                  <div className="space-y-3 mb-10">
                    <div className="flex items-center gap-3 text-purple-300 justify-center">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Full playback control</span>
                    </div>
                    <div className="flex items-center gap-3 text-purple-300 justify-center">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <span>Music library access</span>
                    </div>
                    <div className="flex items-center gap-3 text-purple-300 justify-center">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                      <span>Invite unlimited friends</span>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate('/host/group')}
                    className="w-full py-5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-2xl font-bold text-lg transition-all duration-300 transform hover:scale-105 shadow-xl shadow-purple-500/25 hover:shadow-purple-500/40 flex items-center justify-center gap-3"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Create New Session
                  </button>
                </div>
              </div>

              {/* Join Option */}
              <div className="group bg-gray-900/40 backdrop-blur-2xl border border-gray-700/50 rounded-3xl p-10 hover:bg-gray-900/60 hover:border-gray-600/50 transition-all duration-500 hover:shadow-2xl hover:scale-105">
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto mb-8 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h3 className="text-3xl font-bold mb-6 text-white group-hover:text-emerald-200 transition-colors">Join a Session</h3>
                  <p className="text-gray-300 mb-10 leading-relaxed text-lg">
                    Connect with friends who are already hosting. Experience perfect synchronization and enjoy music together, no matter the distance.
                  </p>
                  
                  {/* Join Features */}
                  <div className="space-y-3 mb-10">
                    <div className="flex items-center gap-3 text-emerald-300 justify-center">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>Perfect synchronization</span>
                    </div>
                    <div className="flex items-center gap-3 text-emerald-300 justify-center">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>Instant connection</span>
                    </div>
                    <div className="flex items-center gap-3 text-emerald-300 justify-center">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span>Secure & private</span>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate('/join/group')}
                    className="w-full py-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl font-bold text-lg transition-all duration-300 transform hover:scale-105 shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 flex items-center justify-center gap-3"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    Find & Join Session
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Features Section */}
          <div className="mb-20">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Why Choose Music Sync?
              </h2>
              <p className="text-xl text-gray-400 max-w-3xl mx-auto">
                Experience the future of collaborative music listening with cutting-edge technology
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center p-8 bg-gray-900/20 backdrop-blur-sm border border-gray-700/30 rounded-2xl hover:bg-gray-900/40 hover:border-gray-600/50 transition-all duration-300 group">
                <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h4 className="text-xl font-bold mb-4 text-white">Lightning Fast Sync</h4>
                <p className="text-gray-400 leading-relaxed">
                  Sub-millisecond synchronization ensures everyone experiences the exact same moment in perfect harmony, regardless of location.
                </p>
              </div>

              <div className="text-center p-8 bg-gray-900/20 backdrop-blur-sm border border-gray-700/30 rounded-2xl hover:bg-gray-900/40 hover:border-gray-600/50 transition-all duration-300 group">
                <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                  </svg>
                </div>
                <h4 className="text-xl font-bold mb-4 text-white">Global Reach</h4>
                <p className="text-gray-400 leading-relaxed">
                  Connect with friends anywhere on Earth. Our optimized infrastructure delivers consistent performance across continents.
                </p>
              </div>

              <div className="text-center p-8 bg-gray-900/20 backdrop-blur-sm border border-gray-700/30 rounded-2xl hover:bg-gray-900/40 hover:border-gray-600/50 transition-all duration-300 group">
                <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <h4 className="text-xl font-bold mb-4 text-white">Effortless Experience</h4>
                <p className="text-gray-400 leading-relaxed">
                  No complex setup or technical knowledge required. Create or join sessions with just a few clicks and start listening together.
                </p>
              </div>
            </div>
          </div>

          {/* Technical Excellence Section */}
          <div className="bg-gradient-to-br from-gray-900/40 via-gray-800/40 to-gray-900/40 backdrop-blur-2xl border border-gray-700/50 rounded-3xl p-12 shadow-2xl">
            <div className="text-center mb-12">
              <h3 className="text-3xl font-bold mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Built for Performance
              </h3>
              <p className="text-xl text-gray-400">Enterprise-grade technology powering seamless music experiences</p>
            </div>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="text-3xl font-bold text-emerald-400 mb-2">&lt;10ms</div>
                <div className="text-gray-300 font-semibold mb-2">Latency</div>
                <div className="text-sm text-gray-500">Near-instant sync</div>
              </div>
              
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-400 mb-2">99.9%</div>
                <div className="text-gray-300 font-semibold mb-2">Uptime</div>
                <div className="text-sm text-gray-500">Always available</div>
              </div>
              
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-400 mb-2">∞</div>
                <div className="text-gray-300 font-semibold mb-2">Participants</div>
                <div className="text-sm text-gray-500">No limits</div>
              </div>
              
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-400 mb-2">HD</div>
                <div className="text-gray-300 font-semibold mb-2">Quality</div>
                <div className="text-sm text-gray-500">Crystal clear</div>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="text-center py-12 border-t border-gray-800/50">
          <div className="max-w-4xl mx-auto px-6">
            <div className="mb-6">
              <p className="text-gray-400 text-lg">
                Built for music lovers, by music lovers
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-8 text-sm text-gray-500">
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                Real-time technology
              </span>
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                Global infrastructure
              </span>
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                Open source
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default Home;