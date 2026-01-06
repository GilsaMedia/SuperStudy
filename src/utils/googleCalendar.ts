/**
 * Google Calendar integration utilities
 * Generates Google Calendar links for easy event addition
 */

/**
 * Generate a Google Calendar URL for adding an event
 * This opens Google Calendar with pre-filled event details
 */
export function generateGoogleCalendarLink(
  appointmentData: {
    title: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    location?: string;
  }
): string {
  // Format dates in YYYYMMDDTHHmmss format (Google Calendar format)
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}T${hours}${minutes}${seconds}`;
  };

  // Calculate end time (default to 1 hour duration)
  const endTime = appointmentData.endTime || new Date(appointmentData.startTime.getTime() + 60 * 60 * 1000);

  // Build the Google Calendar URL
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: appointmentData.title,
    dates: `${formatDate(appointmentData.startTime)}/${formatDate(endTime)}`,
    details: appointmentData.description || '',
    location: appointmentData.location || '',
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Open Google Calendar in a new window/tab with the event pre-filled
 */
export function openGoogleCalendar(appointmentData: {
  title: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
  location?: string;
}): void {
  const url = generateGoogleCalendarLink({
    ...appointmentData,
    endTime: appointmentData.endTime || new Date(appointmentData.startTime.getTime() + 60 * 60 * 1000),
  });
  window.open(url, '_blank', 'noopener,noreferrer');
}

