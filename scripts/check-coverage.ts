import { createAdminClient } from '../src/lib/supabase/admin';

async function main() {
  const sb = createAdminClient();
  for (const origin of ['DUB', 'LHR', 'CDG']) {
    const { data } = await sb
      .from('indicative_prices')
      .select('destination_country')
      .eq('origin', origin);
    const countries = [...new Set((data ?? []).map((r: { destination_country: string }) => r.destination_country))].sort();
    console.log(`\n${origin} has indicative data for ${countries.length} countries:`);
    console.log(countries.join(', '));
  }
}

main().catch((e) => {
  console.error('Failed:', e);
  process.exit(1);
});
