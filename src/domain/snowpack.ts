/**
 * A measured snowpack reading from a physical station — as opposed to the
 * modeled depth a weather grid produces (`MountainWeather.modelSnowDepthIn`).
 *
 * In the US these come from the NRCS SNOTEL network: automated sites with a
 * snow pillow (snow water equivalent), a depth sensor and a precipitation
 * gauge, most of them sitting within a few miles of a Colorado ski area at
 * roughly base-to-mid-mountain elevation. A station is not the ski area — it
 * is a nearby point, at its own elevation, and a reading always names the
 * station so nobody mistakes "Vail Mountain SNOTEL, 10,300 ft" for "the
 * base of Vail". That distance and elevation are part of the record, not a
 * footnote.
 */
export interface SnowpackObservation {
  /** Station identifier in the source network, e.g. "842:CO:SNTL". */
  stationId: string;
  /** Station name as the network publishes it, e.g. "Vail Mountain". */
  stationName: string;
  /** Station elevation, feet. `null` if the network didn't say. */
  stationElevationFt: number | null;
  /** Straight-line distance from the mountain's coordinates, miles. */
  distanceMiles: number;
  /** Measured snow depth, inches. `null` when the sensor didn't report. */
  snowDepthIn: number | null;
  /** Snow water equivalent, inches of water. `null` when not reported. */
  sweIn: number | null;
  /**
   * Bulk density of the standing snowpack, as SWE / depth (0..1). Around
   * 0.25 is a typical settled Colorado pack; a fresh storm layer is far
   * lighter. `null` when either input is missing.
   */
  packDensity: number | null;
  /** Depth change over the last 24 hours, inches — positive means it snowed. `null` when yesterday's reading is missing. */
  depthChange24hIn: number | null;
  /**
   * Sum of the positive daily depth increases over the last five days,
   * inches. Settlement means this *undercounts* what fell; it is a floor on
   * new snow, never the storm total a resort would publish.
   */
  newSnow5dIn: number | null;
  /** The observation date this reading is for, as the network reports it (local calendar date). */
  observedOn: string;
  /** Where a person can see the same numbers. */
  sourceUrl: string;
}
