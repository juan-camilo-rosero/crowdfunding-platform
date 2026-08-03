import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * City autocomplete proxy for the onboarding form.
 *
 * The Places API key lives ONLY here. It is read from GOOGLE_MAPS_API_KEY —
 * deliberately without the NEXT_PUBLIC_ prefix, which is what would bundle it
 * into the browser — and the browser only ever sees the slim list this handler
 * returns. Calling Google straight from the client would expose a billable key
 * to anyone who opens devtools.
 *
 * Authentication is required even though the data is not private: an open proxy
 * to a metered Google endpoint is somebody else's bill waiting to happen.
 */

/** Places types that mean "a city"; keeps regions and streets out. */
const CITY_TYPES = ["locality", "administrative_area_level_3"];

/** Nudges results toward where the investors are, without excluding others. */
const REGION_CODE = "co";

/** Shorter than this and the suggestions are noise. */
const MIN_QUERY_LENGTH = 2;

export type PlacePrediction = {
  placeId: string;
  /** Full label shown in the dropdown, e.g. "Medellín, Antioquia, Colombia". */
  description: string;
  /** Just the city, for storing. */
  city: string;
  /** Trailing part of the label; the country when Google supplies it. */
  country: string;
};

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ predictions: [] });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    // Configuration gap, not a user error: 503 so the field can offer a retry
    // instead of pretending the city does not exist.
    return NextResponse.json({ error: "not-configured" }, { status: 503 });
  }

  try {
    const response = await fetch(
      "https://places.googleapis.com/v1/places:autocomplete",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
        },
        body: JSON.stringify({
          input: query,
          includedPrimaryTypes: CITY_TYPES,
          regionCode: REGION_CODE,
          languageCode: "es",
        }),
      }
    );

    if (!response.ok) {
      return NextResponse.json({ error: "upstream" }, { status: 502 });
    }

    const payload = (await response.json()) as {
      suggestions?: {
        placePrediction?: {
          placeId?: string;
          text?: { text?: string };
          structuredFormat?: {
            mainText?: { text?: string };
            secondaryText?: { text?: string };
          };
        };
      }[];
    };

    const predictions: PlacePrediction[] = (payload.suggestions ?? [])
      .map((suggestion) => suggestion.placePrediction)
      .filter((prediction) => !!prediction?.placeId)
      .map((prediction) => {
        const description = prediction!.text?.text ?? "";
        const main = prediction!.structuredFormat?.mainText?.text ?? description;
        const secondary =
          prediction!.structuredFormat?.secondaryText?.text ?? "";
        return {
          placeId: prediction!.placeId!,
          description: description || main,
          city: main,
          // The country is the last comma-separated part of the secondary text.
          country: secondary.split(",").pop()?.trim() ?? "",
        };
      });

    return NextResponse.json({ predictions });
  } catch {
    return NextResponse.json({ error: "network" }, { status: 502 });
  }
}
