import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface MediaResult {
  valid: boolean;
  platform?: "youtube" | "spotify";
  type?: string;
  embed_url?: string;
  id?: string;
  error?: string;
}

function parseYouTube(url: string): MediaResult | null {
  // youtube.com/watch?v=ID
  let match = url.match(/(?:youtube\.com\/watch\?.*v=)([\w-]{11})/);
  if (match) return { valid: true, platform: "youtube", type: "video", id: match[1], embed_url: `https://www.youtube.com/embed/${match[1]}` };

  // youtu.be/ID
  match = url.match(/youtu\.be\/([\w-]{11})/);
  if (match) return { valid: true, platform: "youtube", type: "video", id: match[1], embed_url: `https://www.youtube.com/embed/${match[1]}` };

  // youtube.com/embed/ID
  match = url.match(/youtube\.com\/embed\/([\w-]{11})/);
  if (match) return { valid: true, platform: "youtube", type: "video", id: match[1], embed_url: `https://www.youtube.com/embed/${match[1]}` };

  // youtube.com/playlist?list=ID
  match = url.match(/youtube\.com\/playlist\?.*list=([\w-]+)/);
  if (match) return { valid: true, platform: "youtube", type: "playlist", id: match[1], embed_url: `https://www.youtube.com/embed/videoseries?list=${match[1]}` };

  // youtube.com/shorts/ID
  match = url.match(/youtube\.com\/shorts\/([\w-]{11})/);
  if (match) return { valid: true, platform: "youtube", type: "video", id: match[1], embed_url: `https://www.youtube.com/embed/${match[1]}` };

  return null;
}

function parseSpotify(url: string): MediaResult | null {
  // open.spotify.com/{type}/{id}
  const match = url.match(/open\.spotify\.com\/(track|album|playlist|artist|episode|show)\/([\w]+)/);
  if (match) {
    const type = match[1];
    const id = match[2];
    return { valid: true, platform: "spotify", type, id, embed_url: `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0` };
  }

  // spotify:{type}:{id}
  const uriMatch = url.match(/spotify:(track|album|playlist|artist|episode|show):([\w]+)/);
  if (uriMatch) {
    const type = uriMatch[1];
    const id = uriMatch[2];
    return { valid: true, platform: "spotify", type, id, embed_url: `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0` };
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ valid: false, error: "URL is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trimmed = url.trim();

    const ytResult = parseYouTube(trimmed);
    if (ytResult) {
      return new Response(JSON.stringify(ytResult), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const spResult = parseSpotify(trimmed);
    if (spResult) {
      return new Response(JSON.stringify(spResult), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ valid: false, error: "URL tidak dikenali. Gunakan link YouTube atau Spotify." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("media-embed error:", e);
    return new Response(JSON.stringify({ valid: false, error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
