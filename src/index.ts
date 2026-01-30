import { createAgent } from '@lucid-agents/core';
import { http } from '@lucid-agents/http';
import { createAgentApp } from '@lucid-agents/hono';
import { payments, paymentsFromEnv } from '@lucid-agents/payments';
import { z } from 'zod';

const SPACEDEVS_BASE = 'https://ll.thespacedevs.com/2.3.0';

const agent = await createAgent({
  name: 'space-launch-tracker',
  version: '1.0.0',
  description: 'Real-time space launch data: upcoming launches, astronauts, agencies, and events from SpaceDevs API',
})
  .use(http())
  .use(payments({ config: paymentsFromEnv() }))
  .build();

const { app, addEntrypoint } = await createAgentApp(agent);

// === HELPER: Fetch real data from SpaceDevs ===
async function fetchSpaceDevs(endpoint: string) {
  const response = await fetch(`${SPACEDEVS_BASE}${endpoint}`);
  if (!response.ok) throw new Error(`SpaceDevs API error: ${response.status}`);
  return response.json();
}

// === FREE ENDPOINT: Overview ===
addEntrypoint({
  key: 'overview',
  description: 'Free overview of next 5 upcoming launches - try before you buy',
  input: z.object({}),
  price: { amount: 0 },
  handler: async () => {
    const data = await fetchSpaceDevs('/launches/upcoming/?limit=5');
    const launches = data.results.map((l: any) => ({
      name: l.name,
      status: l.status?.name,
      net: l.net,
      provider: l.launch_service_provider?.name,
      rocket: l.rocket?.configuration?.full_name,
      mission: l.mission?.name,
      missionType: l.mission?.type,
      pad: l.pad?.name,
    }));
    return {
      output: {
        totalUpcoming: data.count,
        nextLaunches: launches,
        fetchedAt: new Date().toISOString(),
        dataSource: 'SpaceDevs Launch Library 2 (live)',
      },
    };
  },
});

// === PAID ENDPOINT 1 ($0.001): Lookup specific launch ===
addEntrypoint({
  key: 'lookup',
  description: 'Look up a specific launch by ID or search term',
  input: z.object({
    query: z.string().describe('Launch ID (UUID) or search term'),
  }),
  price: { amount: 1000 },
  handler: async (ctx) => {
    const { query } = ctx.input;
    // Try as ID first, then search
    let data;
    if (query.match(/^[0-9a-f-]{36}$/i)) {
      data = await fetchSpaceDevs(`/launches/${query}/`);
      return {
        output: {
          id: data.id,
          name: data.name,
          status: data.status?.name,
          net: data.net,
          windowStart: data.window_start,
          windowEnd: data.window_end,
          provider: data.launch_service_provider?.name,
          rocket: data.rocket?.configuration?.full_name,
          mission: {
            name: data.mission?.name,
            type: data.mission?.type,
            description: data.mission?.description,
            orbit: data.mission?.orbit?.name,
          },
          pad: {
            name: data.pad?.name,
            location: data.pad?.location?.name,
          },
          image: data.image?.image_url,
          fetchedAt: new Date().toISOString(),
        },
      };
    }
    // Search by name
    data = await fetchSpaceDevs(`/launches/?search=${encodeURIComponent(query)}&limit=5`);
    return {
      output: {
        count: data.count,
        results: data.results.map((l: any) => ({
          id: l.id,
          name: l.name,
          status: l.status?.name,
          net: l.net,
          provider: l.launch_service_provider?.name,
        })),
        fetchedAt: new Date().toISOString(),
      },
    };
  },
});

// === PAID ENDPOINT 2 ($0.002): Search launches ===
addEntrypoint({
  key: 'search',
  description: 'Search launches by agency, rocket, or mission type',
  input: z.object({
    agency: z.string().optional().describe('Filter by agency name (e.g., SpaceX, NASA, ESA)'),
    rocket: z.string().optional().describe('Filter by rocket name (e.g., Falcon 9, Starship)'),
    search: z.string().optional().describe('General search term'),
    limit: z.number().optional().default(10).describe('Max results (1-20)'),
  }),
  price: { amount: 2000 },
  handler: async (ctx) => {
    const params = new URLSearchParams();
    if (ctx.input.agency) params.set('lsp__name__icontains', ctx.input.agency);
    if (ctx.input.rocket) params.set('rocket__configuration__name__icontains', ctx.input.rocket);
    if (ctx.input.search) params.set('search', ctx.input.search);
    params.set('limit', String(Math.min(ctx.input.limit ?? 10, 20)));

    const data = await fetchSpaceDevs(`/launches/upcoming/?${params.toString()}`);
    return {
      output: {
        count: data.count,
        results: data.results.map((l: any) => ({
          id: l.id,
          name: l.name,
          status: l.status?.name,
          net: l.net,
          provider: l.launch_service_provider?.name,
          rocket: l.rocket?.configuration?.full_name,
          mission: l.mission?.name,
          missionType: l.mission?.type,
        })),
        fetchedAt: new Date().toISOString(),
      },
    };
  },
});

// === PAID ENDPOINT 3 ($0.002): Upcoming by timeframe ===
addEntrypoint({
  key: 'upcoming',
  description: 'Get upcoming launches within a time window',
  input: z.object({
    days: z.number().optional().default(7).describe('Number of days to look ahead (1-30)'),
    limit: z.number().optional().default(10).describe('Max results (1-20)'),
  }),
  price: { amount: 2000 },
  handler: async (ctx) => {
    const days = Math.min(ctx.input.days ?? 7, 30);
    const limit = Math.min(ctx.input.limit ?? 10, 20);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    const params = new URLSearchParams();
    params.set('net__lte', endDate.toISOString());
    params.set('limit', String(limit));
    params.set('ordering', 'net');

    const data = await fetchSpaceDevs(`/launches/upcoming/?${params.toString()}`);
    return {
      output: {
        timeWindow: `Next ${days} days`,
        count: data.count,
        launches: data.results.map((l: any) => ({
          id: l.id,
          name: l.name,
          status: l.status?.name,
          net: l.net,
          provider: l.launch_service_provider?.name,
          rocket: l.rocket?.configuration?.full_name,
          mission: l.mission?.name,
          pad: l.pad?.name,
        })),
        fetchedAt: new Date().toISOString(),
      },
    };
  },
});

// === PAID ENDPOINT 4 ($0.003): Astronaut lookup ===
addEntrypoint({
  key: 'astronaut',
  description: 'Look up astronaut by name',
  input: z.object({
    name: z.string().describe('Astronaut name to search'),
  }),
  price: { amount: 3000 },
  handler: async (ctx) => {
    const data = await fetchSpaceDevs(`/astronauts/?search=${encodeURIComponent(ctx.input.name)}&limit=5`);
    return {
      output: {
        count: data.count,
        astronauts: data.results.map((a: any) => ({
          id: a.id,
          name: a.name,
          status: a.status?.name,
          agency: a.agency?.name,
          nationality: a.nationality?.map((n: any) => n.name).join(', '),
          age: a.age,
          dateOfBirth: a.date_of_birth,
          bio: a.bio,
          timeInSpace: a.time_in_space,
          evaTime: a.eva_time,
          flightsCount: a.flights_count,
          spacewalksCount: a.spacewalks_count,
          firstFlight: a.first_flight,
          lastFlight: a.last_flight,
          inSpace: a.in_space,
          image: a.image?.image_url,
          wiki: a.wiki,
        })),
        fetchedAt: new Date().toISOString(),
      },
    };
  },
});

// === PAID ENDPOINT 5 ($0.005): Full report ===
addEntrypoint({
  key: 'report',
  description: 'Comprehensive space report: launches, events, and agency stats',
  input: z.object({
    agency: z.string().optional().describe('Focus on specific agency (e.g., SpaceX, NASA)'),
  }),
  price: { amount: 5000 },
  handler: async (ctx) => {
    const agencyFilter = ctx.input.agency
      ? `&lsp__name__icontains=${encodeURIComponent(ctx.input.agency)}`
      : '';

    const [launches, events, agencies] = await Promise.all([
      fetchSpaceDevs(`/launches/upcoming/?limit=10${agencyFilter}`),
      fetchSpaceDevs('/events/upcoming/?limit=5'),
      ctx.input.agency
        ? fetchSpaceDevs(`/agencies/?search=${encodeURIComponent(ctx.input.agency)}&limit=3`)
        : fetchSpaceDevs('/agencies/?featured=true&limit=5'),
    ]);

    return {
      output: {
        focus: ctx.input.agency || 'All agencies',
        upcomingLaunches: {
          total: launches.count,
          next: launches.results.map((l: any) => ({
            name: l.name,
            net: l.net,
            status: l.status?.name,
            provider: l.launch_service_provider?.name,
            rocket: l.rocket?.configuration?.full_name,
            mission: l.mission?.name,
          })),
        },
        upcomingEvents: {
          total: events.count,
          next: events.results.map((e: any) => ({
            name: e.name,
            date: e.date,
            type: e.type?.name,
            location: e.location,
            description: e.description,
          })),
        },
        agencies: agencies.results.map((a: any) => ({
          name: a.name,
          abbrev: a.abbrev,
          type: a.type?.name,
          country: a.country?.map((c: any) => c.name).join(', '),
          description: a.description?.slice(0, 200),
          totalLaunches: a.total_launch_count,
          successfulLaunches: a.successful_launches,
          successRate: a.total_launch_count
            ? ((a.successful_launches / a.total_launch_count) * 100).toFixed(1) + '%'
            : 'N/A',
        })),
        generatedAt: new Date().toISOString(),
        dataSource: 'SpaceDevs Launch Library 2 (live)',
      },
    };
  },
});

const port = Number(process.env.PORT ?? 3000);
console.log(`🚀 Space Launch Tracker running on port ${port}`);

export default { port, fetch: app.fetch };
