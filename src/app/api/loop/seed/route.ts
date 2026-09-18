export async function POST() {
  return Response.json({ ok: false, error: 'Legacy mock seeding is disabled. Use the isolated marketing demo.' }, { status: 410 });
}
