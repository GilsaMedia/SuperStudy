import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { doc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useFirebaseAuth } from '../../context/FirebaseAuth';
import CitySelector from '../../components/CitySelector';
import StarRating from '../../components/StarRating';

type TeacherProfileContext = {
  profile: {
    uid: string;
    role: 'teacher' | 'student';
    fullName?: string;
    email?: string;
    subject?: string;
    points?: string;
    location?: string;
    rules?: string;
  } | null;
};

export default function TeacherProfile() {
  const { profile: outletProfile } = useOutletContext<TeacherProfileContext>();
  const { user, profile: authProfile, refreshProfile } = useFirebaseAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [averageRating, setAverageRating] = useState<number>(0);
  const [ratingCount, setRatingCount] = useState<number>(0);
  const [loadingRatings, setLoadingRatings] = useState(true);

  // Use outlet profile if available, otherwise fallback to auth profile
  const profile = outletProfile || authProfile;

  const [formData, setFormData] = useState({
    fullName: profile?.fullName || '',
    subject: profile?.subject || '',
    points: profile?.points || '',
    location: profile?.location || '',
    rules: profile?.rules || '',
  });

  // Update form data when profile changes
  useEffect(() => {
    if (profile) {
      setFormData({
        fullName: profile.fullName || '',
        subject: profile.subject || '',
        points: profile.points || '',
        location: profile.location || '',
        rules: profile.rules || '',
      });
    }
  }, [profile]);

  // Fetch teacher's ratings
  useEffect(() => {
    if (!user?.uid) {
      setLoadingRatings(false);
      return;
    }

    const fetchRatings = async () => {
      try {
        const ratingsRef = collection(db, 'users', user.uid, 'ratings');
        const ratingsSnapshot = await getDocs(ratingsRef);
        
        if (ratingsSnapshot.empty) {
          setAverageRating(0);
          setRatingCount(0);
          setLoadingRatings(false);
          return;
        }

        let totalRating = 0;
        let count = 0;

        ratingsSnapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          const rating = data.rating as number;
          if (typeof rating === 'number' && rating >= 1 && rating <= 5) {
            totalRating += rating;
            count++;
          }
        });

        const average = count > 0 ? totalRating / count : 0;
        setAverageRating(average);
        setRatingCount(count);
      } catch (err) {
        console.error('Error fetching ratings:', err);
        setAverageRating(0);
        setRatingCount(0);
      } finally {
        setLoadingRatings(false);
      }
    };

    void fetchRatings();
  }, [user?.uid]);

  if (!profile) {
    return (
      <div>
        <h1 style={{ fontSize: 26, color: '#ffffff', marginBottom: 12 }}>Your Profile</h1>
        <p style={{ color: '#cbd5f5', marginBottom: 20 }}>Loading profile...</p>
      </div>
    );
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
    setSuccess(false);
  };

  const handleSave = async () => {
    if (!user) {
      setError('You must be logged in to update your profile.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        fullName: formData.fullName.trim() || null,
        subject: formData.subject.trim() || null,
        points: formData.points.trim() || null,
        location: formData.location.trim() || null,
        rules: formData.rules.trim() || null,
      });

      setSuccess(true);
      setIsEditing(false);
      
      // Refresh the profile data
      await refreshProfile();
    } catch (err) {
      console.error('Error updating profile:', err);
      setError('Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      fullName: profile.fullName || '',
      subject: profile.subject || '',
      points: profile.points || '',
      location: profile.location || '',
      rules: (profile as any).rules || '',
    });
    setIsEditing(false);
    setError(null);
    setSuccess(false);
  };

  const fields = [
    { label: 'Name', value: profile.fullName || 'Not set', key: 'fullName' },
    { label: 'Email', value: profile.email || 'Not set', key: 'email', readOnly: true },
    { label: 'Subject', value: profile.subject || 'Not set', key: 'subject' },
    { label: 'Units', value: profile.points || 'Not set', key: 'points' },
    { label: 'Location', value: profile.location || 'Not set', key: 'location' },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 26, color: '#ffffff', marginBottom: 12 }}>Your Profile</h1>
      <p style={{ color: '#cbd5f5', marginBottom: 20 }}>
        {isEditing
          ? 'Edit your profile information. Changes will be visible to students.'
          : 'Review the information students see when they view your profile.'}
      </p>

      {error && (
        <div
          style={{
            marginBottom: 20,
            padding: 12,
            borderRadius: 8,
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5',
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            marginBottom: 20,
            padding: 12,
            borderRadius: 8,
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            color: '#86efac',
            fontSize: 14,
          }}
        >
          Profile updated successfully!
        </div>
      )}

      {/* Rating Display */}
      {!isEditing && (
        <div
          style={{
            marginBottom: 24,
            padding: 20,
            borderRadius: 12,
            background: 'rgba(59,130,246,0.1)',
            border: '1px solid rgba(59,130,246,0.3)',
          }}
        >
          <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            ⭐ Your Rating
          </div>
          {loadingRatings ? (
            <div style={{ color: '#cbd5f5' }}>Loading rating...</div>
          ) : ratingCount > 0 ? (
            <div>
              <StarRating
                rating={averageRating}
                ratingCount={ratingCount}
                interactive={false}
                size="large"
                showCount={true}
              />
              <p style={{ marginTop: 12, color: '#cbd5f5', fontSize: 14 }}>
                Average rating from {ratingCount} {ratingCount === 1 ? 'student' : 'students'}.
              </p>
            </div>
          ) : (
            <div>
              <div style={{ color: '#94a3b8', marginBottom: 8 }}>No ratings yet</div>
              <p style={{ color: '#cbd5f5', fontSize: 14 }}>
                Students can rate you after lessons. Ratings will appear here once you receive your first rating.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="TeacherProfile__section">
        {isEditing ? (
          <div>
            <div className="TeacherProfile__grid">
              {fields.map((field) => (
                <div key={field.label} className="TeacherProfile__item">
                  <label className="TeacherProfile__label" htmlFor={field.key}>
                    {field.label}
                  </label>
                  {field.readOnly ? (
                    <div className="TeacherProfile__value" style={{ opacity: 0.6 }}>
                      {field.value}
                    </div>
                  ) : field.key === 'location' ? (
                    <CitySelector
                      value={formData.location}
                      onChange={(value) => handleInputChange('location', value)}
                      placeholder="Select a city"
                      className="TeacherProfile__input"
                    />
                  ) : (
                    <input
                      id={field.key}
                      type="text"
                      value={formData[field.key as keyof typeof formData]}
                      onChange={(e) => handleInputChange(field.key, e.target.value)}
                      className="TeacherProfile__input"
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                    />
                  )}
                </div>
              ))}
            </div>

            <div style={{ marginTop: 24 }}>
              <label className="TeacherProfile__label" htmlFor="rules" style={{ display: 'block', marginBottom: 8 }}>
                📋 Rules
              </label>
              <textarea
                id="rules"
                value={formData.rules}
                onChange={(e) => handleInputChange('rules', e.target.value)}
                className="TeacherProfile__textarea"
                placeholder="Enter your teaching rules and guidelines..."
                rows={6}
              />
            </div>

            <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
              <button
                type="button"
                className="btn"
                onClick={handleSave}
                disabled={loading}
                style={{
                  background: loading ? '#4b5563' : '#3b82f6',
                  color: '#ffffff',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleCancel}
                disabled={loading}
                style={{
                  background: '#374151',
                  color: '#ffffff',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="TeacherProfile__grid">
              {fields.map((field) => (
                <div key={field.label} className="TeacherProfile__item">
                  <span className="TeacherProfile__label">{field.label}</span>
                  <span className="TeacherProfile__value">{field.value}</span>
                </div>
              ))}
            </div>

            {formData.rules && (
              <div style={{ marginTop: 24, padding: 16, borderRadius: 8, background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.15)' }}>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  📋 Rules
                </div>
                <div style={{ color: '#cbd5f5', fontSize: 14, lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                  {formData.rules}
                </div>
              </div>
            )}

            <button
              type="button"
              className="btn"
              onClick={() => setIsEditing(true)}
              style={{ marginTop: 20, background: '#3b82f6', color: '#ffffff', cursor: 'pointer' }}
            >
              Edit Profile
            </button>
          </>
        )}
      </div>
    </div>
  );
}

