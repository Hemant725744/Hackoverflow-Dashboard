'use server';

export interface SiteAnalytics {
  totalVisits:    number;
  uniqueVisitors: number;
  pageViews:      number;
  since:          string;
  until:          string;
}

export async function getSiteAnalytics(hoursBack = 24): Promise<SiteAnalytics> {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  const token  = process.env.CLOUDFLARE_API_TOKEN;

  const until = new Date();
  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

  const query = `
    query {
      viewer {
        zones(filter: { zoneTag: "${zoneId}" }) {
          httpRequests1hGroups(
            limit: 1000
            filter: {
              datetime_geq: "${since.toISOString()}"
              datetime_leq: "${until.toISOString()}"
            }
          ) {
            sum {
              requests
              pageViews
            }
            uniq {
              uniques
            }
          }
        }
      }
    }
  `;

  const res  = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ query }),
  });

  const json = await res.json();
  const groups = json?.data?.viewer?.zones?.[0]?.httpRequests1hGroups ?? [];

  const totals = groups.reduce(
    (acc: { requests: number; pageViews: number; uniques: number }, g: any) => ({
      requests:  acc.requests  + (g.sum?.requests  ?? 0),
      pageViews: acc.pageViews + (g.sum?.pageViews ?? 0),
      uniques:   acc.uniques   + (g.uniq?.uniques  ?? 0),
    }),
    { requests: 0, pageViews: 0, uniques: 0 }
  );

  return {
    totalVisits:    totals.requests,
    uniqueVisitors: totals.uniques,
    pageViews:      totals.pageViews,
    since:          since.toISOString(),
    until:          until.toISOString(),
  };
}