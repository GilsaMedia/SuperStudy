import React, { useState, useEffect, useRef } from 'react';

type CitySelectorProps = {
  value: string;
  onChange: (city: string) => void;
  required?: boolean;
  className?: string;
  placeholder?: string;
};

type CityOption = {
  name: string;
  displayName: string;
  country?: string;
};

export default function CitySelector({
  value,
  onChange,
  required = false,
  className = '',
  placeholder = 'Search for a city',
}: CitySelectorProps) {
  const [searchQuery, setSearchQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<CityOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch city suggestions from OpenStreetMap Nominatim API (Israeli cities only)
  const fetchCitySuggestions = async (query: string) => {
    if (!query.trim() || query.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

      try {
        setLoading(true);
        setError(null);

      const searchQuery = query.trim();
      
      // Use OpenStreetMap Nominatim API - free, no API key required
      // Filter to Israeli cities only (countrycodes=il)
      // Add "city" to query to help with search accuracy
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        searchQuery
      )}+Israel&countrycodes=il&addressdetails=1&limit=20&accept-language=en`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'SuperStudy/1.0', // Required by Nominatim
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch cities');
      }

      const data = await response.json();

      // Process results to extract city information
      const cityOptions: Array<CityOption & { matchScore: number }> = [];
      const seenNames = new Set<string>();
      const normalizedQuery = searchQuery.toLowerCase();

      if (data && data.length > 0) {
        data.forEach((place: any) => {
          const address = place.address || {};
          const type = place.type?.toLowerCase() || '';
          const classType = place.class?.toLowerCase() || '';
          
          // Only include cities, towns, and villages in Israel
          const isCityType =
            type === 'city' ||
            type === 'town' ||
            type === 'village' ||
            (classType === 'place' &&
              (address.city || address.town || address.village || address.municipality));

          if (isCityType && address.country_code === 'il') {
            const cityName =
              address.city ||
              address.town ||
              address.village ||
              address.municipality ||
              place.name;

            if (!cityName) return;

            const normalizedCityName = cityName.toLowerCase();
            
            // Skip duplicates
            if (seenNames.has(normalizedCityName)) return;
            seenNames.add(normalizedCityName);

            const country = address.country || 'Israel';
            
            // Get district/region for display
            const district = address.state || address.region || '';
            
            // Create display name
            let displayName = cityName;
            if (district) {
              displayName = `${cityName}, ${district}`;
            }

            // Calculate match score to prioritize better matches
            let matchScore = 0;
            if (normalizedCityName === normalizedQuery) {
              matchScore = 100; // Exact match
            } else if (normalizedCityName.startsWith(normalizedQuery)) {
              matchScore = 80; // Starts with query
            } else if (normalizedCityName.includes(normalizedQuery)) {
              matchScore = 60; // Contains query
            } else {
              // Check if all words in query appear in city name
              const queryWords = normalizedQuery.split(/\s+/);
              const allWordsMatch = queryWords.every(word => normalizedCityName.includes(word));
              if (allWordsMatch) {
                matchScore = 40;
              } else {
                matchScore = 20; // Lower priority for partial matches
              }
            }

            cityOptions.push({
              name: cityName,
              displayName: displayName,
              country: country,
              matchScore: matchScore,
            });
          }
        });
      }

      // Sort by match score (highest first) and limit to top 10
      cityOptions.sort((a, b) => b.matchScore - a.matchScore);
      const topResults = cityOptions.slice(0, 10).map(({ matchScore, ...city }) => city);

      setSuggestions(topResults);
      setShowSuggestions(topResults.length > 0);
      setSelectedIndex(-1);
    } catch (err: any) {
      console.error('Error fetching city suggestions:', err);
        setError('Failed to load cities. Please try again.');
      setSuggestions([]);
      setShowSuggestions(false);
      } finally {
        setLoading(false);
      }
    };

  // Debounce search queries
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        fetchCitySuggestions(searchQuery);
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Sync searchQuery with value prop
  useEffect(() => {
    if (value && value !== searchQuery) {
      setSearchQuery(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchQuery(newValue);
    if (!newValue) {
      onChange('');
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectCity = (city: CityOption) => {
    setSearchQuery(city.name);
    onChange(city.name);
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter' && searchQuery.trim()) {
        // If no suggestions shown but user presses enter, select the typed value
        onChange(searchQuery.trim());
        setShowSuggestions(false);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelectCity(suggestions[selectedIndex]);
        } else if (suggestions.length > 0) {
          handleSelectCity(suggestions[0]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleInputFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const isInputField = className && className.includes('input-field');
  
  const inputStyle: React.CSSProperties = isInputField
    ? {
        width: '100%',
      }
    : {
        flex: 1,
        padding: '10px 12px',
        borderRadius: 10,
        border: '1px solid rgba(148,163,184,0.35)',
        background: 'rgba(2,6,23,0.6)',
        color: '#e2e8f0',
        fontSize: 14,
      };
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} ref={containerRef}>
        {isInputField ? (
            <div className="input-group" style={{ position: 'relative', flex: 1 }}>
              <span className="input-icon">📍</span>
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleInputFocus}
                required={required}
                className={className || ''}
            placeholder={loading ? 'Searching cities...' : placeholder}
            style={inputStyle}
            autoComplete="off"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 4,
                background: '#1e293b',
                border: '1px solid rgba(148,163,184,0.35)',
                borderRadius: 10,
                maxHeight: 300,
                overflowY: 'auto',
                zIndex: 1000,
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
              }}
            >
              {suggestions.map((city, index) => (
                <div
                  key={`${city.name}-${index}`}
                  onClick={() => handleSelectCity(city)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    background: selectedIndex === index ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                    color: '#e2e8f0',
                    fontSize: 14,
                    borderBottom: index < suggestions.length - 1 ? '1px solid rgba(148,163,184,0.1)' : 'none',
                  }}
                >
                  <div style={{ fontWeight: 500 }}>{city.name}</div>
                  {city.displayName !== city.name && (
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                      {city.displayName.replace(city.name + ', ', '')}
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
      ) : (
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleInputFocus}
            required={required}
            placeholder={loading ? 'Searching cities...' : placeholder}
            style={inputStyle}
            autoComplete="off"
          />
          {showSuggestions && suggestions.length > 0 && (
        <div
          style={{
                position: 'absolute',
                top: '100%',
            left: 0,
            right: 0,
                marginTop: 4,
                background: '#1e293b',
                border: '1px solid rgba(148,163,184,0.35)',
                borderRadius: 10,
                maxHeight: 300,
                overflowY: 'auto',
            zIndex: 1000,
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
              }}
            >
              {suggestions.map((city, index) => (
                <div
                  key={`${city.name}-${index}`}
                  onClick={() => handleSelectCity(city)}
                  onMouseEnter={() => setSelectedIndex(index)}
                style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    background: selectedIndex === index ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                      color: '#e2e8f0',
                      fontSize: 14,
                    borderBottom: index < suggestions.length - 1 ? '1px solid rgba(148,163,184,0.1)' : 'none',
                  }}
                >
                  <div style={{ fontWeight: 500 }}>{city.name}</div>
                  {city.displayName !== city.name && (
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                      {city.displayName.replace(city.name + ', ', '')}
                  </div>
                )}
                </div>
              ))}
            </div>
            )}
        </div>
      )}
      {error && (
        <small style={{ color: '#fca5a5', fontSize: 12 }}>{error}</small>
      )}
      {!loading && searchQuery.length > 0 && searchQuery.length < 2 && (
        <small style={{ color: '#94a3b8', fontSize: 12 }}>
          Type at least 2 characters to search for cities
        </small>
      )}
    </div>
  );
}

