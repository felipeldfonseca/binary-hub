// Mock data for dashboard development

export const mockKPIData = {
  day: {
    netPnl: 250,
    winRate: 78,
    result: 12.5,
    avgDailyPnl: 184,
    dailyStreak: 3,
  },
  week: {
    netPnl: 1240,
    winRate: 72,
    result: 8.3,
    avgDailyPnl: 177,
    dailyStreak: 5,
  },
  month: {
    netPnl: 4680,
    winRate: 68,
    result: 15.2,
    avgDailyPnl: 156,
    dailyStreak: 12,
  },
  '3months': {
    netPnl: 12450,
    winRate: 71,
    result: 22.8,
    avgDailyPnl: 164,
    dailyStreak: 8,
  },
  '6months': {
    netPnl: 28900,
    winRate: 69,
    result: 34.5,
    avgDailyPnl: 159,
    dailyStreak: 15,
  },
  year: {
    netPnl: 54200,
    winRate: 67,
    result: 48.7,
    avgDailyPnl: 148,
    dailyStreak: 9,
  },
}

export const mockChartData = {
  day: [
    { date: '9:00', amount: 0 },
    { date: '9:30', amount: 45 },
    { date: '10:00', amount: 78 },
    { date: '10:30', amount: 120 },
    { date: '11:00', amount: 95 },
    { date: '11:30', amount: 165 },
    { date: '12:00', amount: 250 },
  ],
  week: [
    { date: 'Mon', amount: 0 },
    { date: 'Tue', amount: 180 },
    { date: 'Wed', amount: 320 },
    { date: 'Thu', amount: 290 },
    { date: 'Fri', amount: 450 },
    { date: 'Sat', amount: 680 },
    { date: 'Sun', amount: 1240 },
  ],
  month: [
    { date: 'Week 1', amount: 0 },
    { date: 'Week 2', amount: 820 },
    { date: 'Week 3', amount: 1450 },
    { date: 'Week 4', amount: 2100 },
    { date: 'Week 5', amount: 4680 },
  ],
  '3months': [
    { date: 'Jan', amount: 0 },
    { date: 'Feb', amount: 3200 },
    { date: 'Mar', amount: 6800 },
    { date: 'Apr', amount: 12450 },
  ],
  '6months': [
    { date: 'Aug', amount: 0 },
    { date: 'Sep', amount: 4500 },
    { date: 'Oct', amount: 8900 },
    { date: 'Nov', amount: 15600 },
    { date: 'Dec', amount: 22300 },
    { date: 'Jan', amount: 28900 },
  ],
  year: [
    { date: 'Q1', amount: 0 },
    { date: 'Q2', amount: 12400 },
    { date: 'Q3', amount: 28900 },
    { date: 'Q4', amount: 54200 },
  ],
}

export const mockCalendarEvents = [
  { date: '2025-01-15', result: 'win', amount: 120 },
  { date: '2025-01-16', result: 'win', amount: 85 },
  { date: '2025-01-17', result: 'loss', amount: -45 },
  { date: '2025-01-18', result: 'win', amount: 200 },
  { date: '2025-01-19', result: 'win', amount: 90 },
  { date: '2025-01-20', result: 'win', amount: 160 },
  { date: '2025-01-21', result: 'neutral', amount: 0 },
]

export const mockEconomicEvents = [
  {
    id: 1,
    time: '08:30',
    event: 'US CPI (Core) YoY',
    impact: 'high',
    previous: '3.2%',
    forecast: '3.3%',
    actual: null,
  },
  {
    id: 2,
    time: '10:00',
    event: 'US Retail Sales MoM',
    impact: 'high',
    previous: '0.7%',
    forecast: '0.3%',
    actual: null,
  },
  {
    id: 3,
    time: '14:00',
    event: 'Fed Chair Powell Speech',
    impact: 'high',
    previous: null,
    forecast: null,
    actual: null,
  },
  {
    id: 4,
    time: '15:30',
    event: 'US Crude Oil Inventories',
    impact: 'medium',
    previous: '-2.5M',
    forecast: '-1.2M',
    actual: null,
  },
] 