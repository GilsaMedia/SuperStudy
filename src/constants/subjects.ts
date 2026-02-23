/**
 * School subjects for teacher profiles and filters.
 * Teachers can select multiple subjects (checkboxes).
 */
export const SUBJECTS = [
  'Math',
  'English',
  'Literature',
  'Physics',
  'Chemistry',
  'Biology',
  'History',
  'Geography',
  'Computer Science',
  'Spanish',
  'French',
  'Art',
  'Music',
  'Physical Education',
  'Economics',
  'Civics',
  'Sociology',
  'Psychology',
  'Environmental Science',
  'Statistics',
  'Calculus',
  'Algebra',
  'Geometry',
  'Trigonometry',
  'Writing',
  'Reading',
  'Social Studies',
  'Health',
  'Drama',
  'Other',
] as const;

export type Subject = (typeof SUBJECTS)[number];
