import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleTallySync } from "./handler.ts";

Deno.serve((request) => handleTallySync(request, {
  syncKey: Deno.env.get("TALLY_SYNC_KEY") ?? "",
  database: () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  }),
}));
