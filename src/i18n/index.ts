import { common } from './he/common';
import { auth } from './he/auth';
import { student } from './he/student';
import { teacher } from './he/teacher';
import { helper } from './he/helper';

/** Hebrew translations keyed by the English source string. */
export const he: Record<string, string> = {
  ...common,
  ...auth,
  ...student,
  ...teacher,
  ...helper,
};
