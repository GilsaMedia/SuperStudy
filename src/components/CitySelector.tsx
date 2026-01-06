import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, addDoc, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useFirebaseAuth } from '../context/FirebaseAuth';
import { validateCity } from '../utils/cityValidation';

type CitySelectorProps = {
  value: string;
  onChange: (city: string) => void;
  required?: boolean;
  className?: string;
  placeholder?: string;
};

type City = {
  id: string;
  name: string;
  createdAt?: any;
};

export default function CitySelector({
  value,
  onChange,
  required = false,
  className = '',
  placeholder = 'Select a city',
}: CitySelectorProps) {
  const { user } = useFirebaseAuth();
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestCityName, setRequestCityName] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [validatingCity, setValidatingCity] = useState(false);

  // Fetch cities from Firestore
  useEffect(() => {
    const fetchCities = async () => {
      try {
        setLoading(true);
        setError(null);
        const citiesRef = collection(db, 'cities');
        const q = query(citiesRef, orderBy('name', 'asc'));
        const snapshot = await getDocs(q);
        const citiesData: City[] = [];
        snapshot.forEach((doc) => {
          citiesData.push({
            id: doc.id,
            ...doc.data(),
          } as City);
        });
        setCities(citiesData);
      } catch (err) {
        console.error('Error fetching cities:', err);
        setError('Failed to load cities. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchCities();
  }, []);

  const handleRequestCity = async () => {
    if (!requestCityName.trim()) {
      return;
    }

    setSubmittingRequest(true);
    setValidatingCity(true);
    setError(null);

    try {
      // Check if city already exists (case-insensitive)
      const normalizedRequest = requestCityName.trim().toLowerCase();
      const cityExists = cities.some(
        (city) => city.name.toLowerCase() === normalizedRequest
      );

      if (cityExists) {
        setError('This city already exists in the list.');
        setSubmittingRequest(false);
        setValidatingCity(false);
        return;
      }

      // Validate city exists using geocoding API
      const validation = await validateCity(requestCityName.trim());
      
      if (!validation.isValid) {
        setError(validation.error || 'City validation failed. Please check the city name and try again.');
        setSubmittingRequest(false);
        setValidatingCity(false);
        return;
      }

      // Use normalized name from validation
      const normalizedCityName = validation.normalizedName || requestCityName.trim();
      
      // Double-check normalized name doesn't already exist
      const normalizedExists = cities.some(
        (city) => city.name.toLowerCase() === normalizedCityName.toLowerCase()
      );

      if (normalizedExists) {
        setError(`"${normalizedCityName}" already exists in the list.`);
        setSubmittingRequest(false);
        setValidatingCity(false);
        return;
      }

      // Check if city already exists in Firestore (case-insensitive)
      try {
        const citiesRef = collection(db, 'cities');
        const cityQuery = query(citiesRef, where('name', '==', normalizedCityName));
        const snapshot = await getDocs(cityQuery);
        
        if (!snapshot.empty) {
          setError(`"${normalizedCityName}" already exists in the list.`);
          setSubmittingRequest(false);
          setValidatingCity(false);
          return;
        }
      } catch (checkErr) {
        console.error('Error checking existing cities:', checkErr);
        // Continue anyway - worst case is a duplicate
      }

      setValidatingCity(false);

      // City is valid - add it directly to cities collection
      const cityData: any = {
        name: normalizedCityName,
        createdAt: serverTimestamp(),
      };

      // Add user info if logged in
      if (user) {
        cityData.addedBy = user.uid;
        cityData.addedByName = user.displayName || user.email || 'Unknown';
      } else {
        cityData.addedBy = null;
        cityData.addedByName = 'Anonymous';
      }

      await addDoc(collection(db, 'cities'), cityData);

      // Also log the request for admin tracking (only if user is logged in)
      if (user) {
        try {
          await addDoc(collection(db, 'cityRequests'), {
            cityName: normalizedCityName,
            requestedBy: user.uid,
            requestedByName: user.displayName || user.email || 'Unknown',
            status: 'approved',
            autoApproved: true,
            createdAt: serverTimestamp(),
            approvedAt: serverTimestamp(),
          });
        } catch (logErr) {
          // Log error but don't fail the operation
          console.error('Error logging city request:', logErr);
        }
      }

      // Refresh cities list
      const citiesRef = collection(db, 'cities');
      const q = query(citiesRef, orderBy('name', 'asc'));
      const snapshot = await getDocs(q);
      const citiesData: City[] = [];
      snapshot.forEach((doc) => {
        citiesData.push({
          id: doc.id,
          ...doc.data(),
        } as City);
      });
      setCities(citiesData);

      // Set the newly added city as selected
      onChange(normalizedCityName);

      setRequestSuccess(true);
      setRequestCityName('');
      setTimeout(() => {
        setShowRequestModal(false);
        setRequestSuccess(false);
      }, 2000);
    } catch (err) {
      console.error('Error adding city:', err);
      setError('Failed to add city. Please try again.');
    } finally {
      setSubmittingRequest(false);
      setValidatingCity(false);
    }
  };

  const isInputField = className && className.includes('input-field');
  
  const requestButton = (
    <button
      type="button"
      onClick={() => setShowRequestModal(true)}
      style={{
        padding: '10px 16px',
        borderRadius: 10,
        border: '1px solid rgba(148,163,184,0.35)',
        background: 'rgba(59, 130, 246, 0.1)',
        color: '#93c5fd',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        fontSize: 14,
        fontWeight: 500,
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
        e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
        e.currentTarget.style.borderColor = 'rgba(148,163,184,0.35)';
      }}
    >
      {isInputField ? '+ Request' : '+ Request City'}
    </button>
  );
  
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {isInputField ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
            <div className="input-group" style={{ position: 'relative', flex: 1 }}>
              <span className="input-icon">📍</span>
              <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                required={required}
                className={className || ''}
                disabled={loading}
                style={{
                  width: '100%',
                }}
              >
                <option value="">{loading ? 'Loading cities...' : placeholder}</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.name}>
                    {city.name}
                  </option>
                ))}
              </select>
            </div>
            {requestButton}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
            <select
              value={value}
              onChange={(e) => onChange(e.target.value)}
              required={required}
              className={className || ''}
              disabled={loading}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.35)',
                background: loading ? 'rgba(2,6,23,0.3)' : 'rgba(2,6,23,0.6)',
                color: '#e2e8f0',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              <option value="">{loading ? 'Loading cities...' : placeholder}</option>
              {cities.map((city) => (
                <option key={city.id} value={city.name}>
                  {city.name}
                </option>
              ))}
            </select>
            {requestButton}
          </div>
        )}
        {error && (
          <small style={{ color: '#fca5a5', fontSize: 12 }}>{error}</small>
        )}
        {cities.length === 0 && !loading && (
          <small style={{ color: '#94a3b8', fontSize: 12 }}>
            No cities available. Please request a city to get started.
          </small>
        )}
      </div>

      {/* Request City Modal */}
      {showRequestModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowRequestModal(false);
              setRequestCityName('');
              setError(null);
              setRequestSuccess(false);
            }
          }}
        >
          <div
            style={{
              background: '#1e293b',
              borderRadius: 16,
              padding: 24,
              maxWidth: 500,
              width: '100%',
              border: '1px solid rgba(148,163,184,0.2)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                fontSize: 20,
                color: '#ffffff',
                marginBottom: 16,
                fontWeight: 600,
              }}
            >
              Request a New City
            </h2>
            <p
              style={{
                color: '#94a3b8',
                fontSize: 14,
                marginBottom: 20,
                lineHeight: 1.6,
              }}
            >
              Don't see your city? Enter the city name and we'll validate it. If it's a real city, 
              it will be added to the list immediately.
            </p>

            {requestSuccess ? (
              <div
                style={{
                  padding: 16,
                  borderRadius: 8,
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  color: '#86efac',
                  fontSize: 14,
                  marginBottom: 20,
                }}
              >
                ✓ City validated and added successfully! You can now select it from the dropdown.
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 20 }}>
                  <label
                    style={{
                      display: 'block',
                      color: '#cbd5f5',
                      fontSize: 14,
                      fontWeight: 500,
                      marginBottom: 8,
                    }}
                  >
                    City Name
                  </label>
                  <input
                    type="text"
                    value={requestCityName}
                    onChange={(e) => {
                      setRequestCityName(e.target.value);
                      setError(null);
                    }}
                    placeholder="e.g., New York, Los Angeles"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid rgba(148,163,184,0.35)',
                      background: 'rgba(2,6,23,0.6)',
                      color: '#e2e8f0',
                      fontSize: 14,
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && requestCityName.trim() && !submittingRequest) {
                        handleRequestCity();
                      }
                    }}
                    autoFocus
                  />
                </div>

                {error && (
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#fca5a5',
                      fontSize: 14,
                      marginBottom: 20,
                    }}
                  >
                    {error}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowRequestModal(false);
                      setRequestCityName('');
                      setError(null);
                    }}
                    style={{
                      padding: '10px 20px',
                      borderRadius: 8,
                      border: '1px solid rgba(148,163,184,0.35)',
                      background: 'rgba(148,163,184,0.1)',
                      color: '#cbd5f5',
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: 500,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleRequestCity}
                    disabled={!requestCityName.trim() || submittingRequest || validatingCity}
                    style={{
                      padding: '10px 20px',
                      borderRadius: 8,
                      border: 'none',
                      background:
                        !requestCityName.trim() || submittingRequest || validatingCity
                          ? 'rgba(59, 130, 246, 0.3)'
                          : '#3b82f6',
                      color: '#ffffff',
                      cursor:
                        !requestCityName.trim() || submittingRequest || validatingCity
                          ? 'not-allowed'
                          : 'pointer',
                      fontSize: 14,
                      fontWeight: 500,
                      opacity:
                        !requestCityName.trim() || submittingRequest || validatingCity ? 0.6 : 1,
                    }}
                  >
                    {validatingCity ? 'Validating...' : submittingRequest ? 'Adding City...' : 'Add City'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

