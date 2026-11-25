export const sampleDashboardBody = {
  date: "2026-11-24",
  generatedAt: "2026-11-24T08:00:00.000Z",
  datetime: {
    status: "ready",
    serverTime: "2026-11-24T08:00:00.000Z",
    timezone: "Europe/Moscow",
    timeFormat: "24"
  },
  widgets: { status: "error", message: "Не удалось загрузить раздел." },
  routines: {
    status: "ready",
    day: {
      date: "2026-11-24",
      progress: { done: 1, total: 3 },
      items: [
        {
          id: "64b7f0c2a1d4e8f01a2b3c52",
          ruleId: "64b7f0c2a1d4e8f01a2b3c53",
          localDate: "2026-11-24",
          title: "Выпить 1 литр воды",
          status: "done",
          completedAt: "2026-11-24T07:00:00.000Z"
        },
        {
          id: "64b7f0c2a1d4e8f01a2b3c54",
          ruleId: "64b7f0c2a1d4e8f01a2b3c55",
          localDate: "2026-11-24",
          title: "Погладить кота",
          status: "pending",
          completedAt: null
        },
        {
          id: "64b7f0c2a1d4e8f01a2b3c56",
          ruleId: "64b7f0c2a1d4e8f01a2b3c57",
          localDate: "2026-11-24",
          title: "Сделать зарядку",
          status: "pending",
          completedAt: null
        }
      ]
    }
  },
  timer: {
    status: "ready",
    timer: {
      session: null,
      settled: null,
      next: { phase: "work", cycleNumber: 0 },
      completedToday: 0,
      dailyGoal: 8
    }
  },
  weather: {
    status: "ready",
    updatedAt: "2026-11-24T07:52:00.000Z",
    weather: {
      locationLabel: "Москва",
      temperature: 11,
      apparentTemperature: 8,
      description: "Облачно с прояснениями",
      precipitationProbability: 30,
      windSpeedKmh: 14,
      min: 7,
      max: 13,
      weatherCode: 2,
      isDay: true,
      scene: "cloudy",
      unit: "celsius",
      hourly: [
        {
          at: "2026-11-24T09:00:00.000Z",
          temperature: 10,
          precipitationProbability: 20,
          weatherCode: 2
        }
      ]
    }
  },
  calendar: {
    status: "ready",
    updatedAt: "2026-11-24T07:50:00.000Z",
    events: [
      {
        id: "64b7f0c2a1d4e8f01a2b3c51",
        title: "Стендап команды",
        startAt: "2027-01-15T09:00:00.000Z",
        endAt: "2027-01-15T09:30:00.000Z",
        allDay: false,
        location: null,
        meetingUrl: "https://meet.google.com/abc-defg-hij",
        htmlLink: "https://calendar.google.com/calendar/event?eid=standup",
        status: "confirmed",
        calendarName: "Работа"
      }
    ]
  },
  news: {
    status: "ready",
    updatedAt: "2026-11-24T07:40:00.000Z",
    items: [
      {
        id: "64b7f0c2a1d4e8f01a2b3c4d",
        title: "OpenAI расширила инструменты для агентных рабочих процессов",
        excerpt: "Короткий обзор новых API для планирования шагов и контроля инструментов.",
        source: "OpenAI",
        official: true,
        topic: "agents",
        topics: ["agents"],
        publishedAt: "2026-11-24T06:30:00.000Z",
        url: "https://openai.com/blog",
        imageUrl: null
      },
      {
        id: "64b7f0c2a1d4e8f01a2b3c4e",
        title: "Meta AI прокомментировала правила прозрачности моделей в ЕС",
        excerpt: "Компания описала, какие карточки моделей появятся в открытом доступе.",
        source: "Meta AI",
        official: false,
        topic: "business",
        topics: ["business"],
        publishedAt: "2026-11-23T10:00:00.000Z",
        url: "https://ai.meta.com/blog",
        imageUrl: null
      }
    ]
  }
};
