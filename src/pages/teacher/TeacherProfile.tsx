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

