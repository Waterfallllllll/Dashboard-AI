export type CalendarRef = Readonly<{
  name: string;
  color: string;
}>;

export type CalendarEvent = Readonly<{
  id: string;
  title: string;
  startAt: number;
  endAt: number;
  allDay: boolean;
  location: string | null;
  meetingUrl: string | null;
  htmlLink: string;
  status: "confirmed" | "tentative";
  calendar: CalendarRef;
}>;
