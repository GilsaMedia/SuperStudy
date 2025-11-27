import React from 'react';
import { useOutletContext } from 'react-router-dom';

type TeacherProfileContext = {
  profile: {
    uid: string;
    role: 'teacher' | 'student';
    fullName?: string;
    email?: string;
    subject?: string;
    points?: string;
    location?: string;
  };
};

export default function TeacherProfile() {
  const { profile } = useOutletContext<TeacherProfileContext>();

  const fields = [
    { label: 'Name', value: profile.fullName || 'Not set' },
    { label: 'Email', value: profile.email || 'Not set' },
    { label: 'Subject', value: profile.subject || 'Not set' },
    { label: 'Units', value: profile.points || 'Not set' },
    { label: 'Location', value: profile.location || 'Not set' },
  ];
  
  // Rules field (if it exists in profile)
  const rules = (profile as any).rules;

  return (
    <div>
      <h1 style={{ fontSize: 26, color: '#ffffff', marginBottom: 12 }}>Your Profile</h1>
      <p style={{ color: '#cbd5f5', marginBottom: 20 }}>
        Review the information students see when they view your profile. Updates can be managed from this page in a future release.
      </p>

      <div className="TeacherProfile__section">
        <div className="TeacherProfile__grid">
          {fields.map((field) => (
            <div key={field.label} className="TeacherProfile__item">
              <span className="TeacherProfile__label">{field.label}</span>
              <span className="TeacherProfile__value">{field.value}</span>
            </div>
          ))}
        </div>

        {rules && (
          <div style={{ marginTop: 24, padding: 16, borderRadius: 8, background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.15)' }}>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              📋 Rules
            </div>
            <div style={{ color: '#cbd5f5', fontSize: 14, lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
              {rules}
            </div>
          </div>
        )}

        <button
          type="button"
          className="btn"
          style={{ marginTop: 20, background: '#374151', color: '#ffffff', cursor: 'not-allowed' }}
          disabled
        >
          Edit profile (coming soon)
        </button>
      </div>
    </div>
  );
}

