import * as Linking from 'expo-linking';

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}${seconds}`;
}

export function generateGoogleCalendarLink(appointmentData: {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
}): string {
  const endTime = appointmentData.endTime || new Date(appointmentData.startTime.getTime() + 60 * 60 * 1000);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: appointmentData.title,
    dates: `${formatDate(appointmentData.startTime)}/${formatDate(endTime)}`,
    details: appointmentData.description || '',
    location: appointmentData.location || '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export async function openGoogleCalendar(appointmentData: {
  title: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
  location?: string;
}): Promise<void> {
  const url = generateGoogleCalendarLink({
    ...appointmentData,
    endTime: appointmentData.endTime || new Date(appointmentData.startTime.getTime() + 60 * 60 * 1000),
  });
  const can = await Linking.canOpenURL(url);
  if (can) Linking.openURL(url);
}
