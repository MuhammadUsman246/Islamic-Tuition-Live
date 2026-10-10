/**
 * Student Email & Handle Generation Utility
 * Domain: islamictuition.us
 *
 * Generates unique, branded student emails combining student name with their unique Student ID.
 * Example:
 * Name: "Ali", Student ID: "STU-101" -> "ali.stu101@islamictuition.us"
 * Name: "Ali Khan", Student ID: "STU-315" -> "ali.stu315@islamictuition.us"
 */

export const ACADEMY_DOMAIN = 'islamictuition.us';

/**
 * Generates a standard student email using their first name and unique student ID.
 * Since student names may collide (multiple "Ali"s), the unique Student ID prevents collisions.
 */
export function generateStudentEmail(name: string, studentId: string): string {
  const rawName = (name || '').trim();
  const firstName = rawName.split(/\s+/)[0] || 'student';
  const cleanName = firstName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'student';
  const cleanId = (studentId || 'stu001').toLowerCase().replace(/[^a-z0-9]/g, '') || 'stu001';
  return `${cleanName}.${cleanId}@${ACADEMY_DOMAIN}`;
}

/**
 * Generates a standard parent fallback email if one is not provided.
 */
export function generateParentEmail(parentName: string, studentId: string): string {
  const rawName = (parentName || '').trim();
  const firstName = rawName.split(/\s+/)[0] || 'parent';
  const cleanName = firstName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'parent';
  const cleanId = (studentId || 'stu001').toLowerCase().replace(/[^a-z0-9]/g, '') || 'stu001';
  return `${cleanName}.${cleanId}.parent@${ACADEMY_DOMAIN}`;
}
