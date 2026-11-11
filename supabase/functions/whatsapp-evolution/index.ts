// Legacy endpoint is intentionally disabled after replacing Evolution with WA-AKG.
// Keeping the route avoids a silent fallback to the old provider.
Deno.serve(() => new Response(
  JSON.stringify({ error: "Evolution API desativada. Use whatsapp-gateway." }),
  { status: 410, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } },
));
